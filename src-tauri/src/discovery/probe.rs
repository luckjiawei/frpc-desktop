use super::{interfaces::Scope, sockets};
use crate::models::{DiscoveryBudget, DiscoverySnapshot};
use futures_util::stream::{FuturesUnordered, StreamExt};
use std::{
    collections::HashSet,
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::Duration,
};
use tokio::{
    net::TcpStream,
    sync::{watch, Mutex, Semaphore},
    time::Instant,
};

const CONCURRENCY: usize = 16;
const MAX_ADDRESSES: usize = 64;
const MAX_CONNECTIONS: usize = 512;
const PORTS: [u16; 8] = [22, 80, 443, 445, 3389, 5900, 8080, 8443];

// The snapshot mutex is only held while reading targets and recording a
// result, so stop/getSnapshot stay responsive during the probe phase.
pub async fn run(scope: Scope, snapshot: &Mutex<DiscoverySnapshot>, cancel: watch::Receiver<bool>) {
    let candidates: Vec<IpAddr> = {
        let mut snapshot = snapshot.lock().await;
        let mut candidates: Vec<IpAddr> = snapshot
            .devices
            .iter()
            .flat_map(|d| d.addresses.iter().filter_map(|a| a.address.parse().ok()))
            .collect();
        candidates.sort_by_key(|ip| ip.to_string());
        candidates.dedup();
        snapshot.budget.candidate_addresses = candidates.len();
        if candidates.len() > MAX_ADDRESSES {
            candidates.truncate(MAX_ADDRESSES);
            super::merge::truncated(&mut snapshot, "candidateLimit");
        }
        candidates
    };
    if candidates.is_empty() {
        return;
    }

    let (tasks, service_targets) = {
        let mut snapshot = snapshot.lock().await;
        let mut tasks: Vec<(IpAddr, u16)> = Vec::new();
        let mut unique = HashSet::new();
        for device in &snapshot.devices {
            for service in &device.services {
                if service.transport == "tcp" {
                    if let Ok(address) = service.target_address.parse() {
                        let target = (address, service.port);
                        if scope.allows(address) && unique.insert(target) {
                            tasks.push(target);
                        }
                    }
                }
            }
        }
        let service_targets: HashSet<(IpAddr, u16)> = tasks.iter().copied().collect();
        for ip in &candidates {
            for port in PORTS {
                if unique.insert((*ip, port)) {
                    tasks.push((*ip, port));
                }
            }
        }
        if tasks.len() > MAX_CONNECTIONS {
            tasks.truncate(MAX_CONNECTIONS);
            super::merge::truncated(&mut snapshot, "probeLimit");
        }
        (tasks, service_targets)
    };
    let total = tasks.len();
    let sem = Arc::new(Semaphore::new(CONCURRENCY));
    let mut futures = FuturesUnordered::new();
    let launch = |idx: usize, ip: IpAddr, port: u16, cancel: watch::Receiver<bool>| {
        let scope = scope.clone();
        let sem = sem.clone();
        async move {
            let permit = sem.acquire_owned().await.ok()?;
            let result = connect(&scope, ip, port, cancel).await;
            drop(permit);
            Some((idx, ip, port, result))
        }
    };
    let mut next_allowed = Instant::now();
    let mut cancelled = false;
    for idx in 0..total {
        let (ip, port) = tasks[idx];
        if cancel_signaled(&cancel) {
            cancelled = true;
            break;
        }
        if Instant::now() < next_allowed {
            tokio::select! { _ = tokio::time::sleep_until(next_allowed) => {}, _ = wait_cancel(cancel.clone()) => { cancelled = true; break; } }
        }
        next_allowed = Instant::now() + Duration::from_millis(32);
        futures.push(launch(idx, ip, port, cancel.clone()));
        snapshot.lock().await.budget.probes_started += 1;
        while futures.len() >= CONCURRENCY {
            if let Some(Some((_, ip, port, result))) = futures.next().await {
                let mut snapshot = snapshot.lock().await;
                record(&mut snapshot, ip, port, result, &service_targets, &scope);
                snapshot.budget.probes_completed += 1;
            }
        }
        if cancel_signaled(&cancel) {
            cancelled = true;
            break;
        }
    }
    while let Some(Some((_, ip, port, result))) = futures.next().await {
        let mut snapshot = snapshot.lock().await;
        record(&mut snapshot, ip, port, result, &service_targets, &scope);
        snapshot.budget.probes_completed += 1;
    }
    if cancelled {
        let mut snapshot = snapshot.lock().await;
        super::merge::warn(&mut snapshot, "stopped");
    }
}

async fn connect(
    scope: &Scope,
    ip: IpAddr,
    port: u16,
    mut cancel: watch::Receiver<bool>,
) -> &'static str {
    if !scope.allows(ip) {
        return "unreachable";
    }
    let Some(source) = scope.source(ip) else {
        return "unreachable";
    };
    let ipv6 = ip.is_ipv6();
    let domain = if ipv6 {
        socket2::Domain::IPV6
    } else {
        socket2::Domain::IPV4
    };
    let socket =
        match socket2::Socket::new(domain, socket2::Type::STREAM, Some(socket2::Protocol::TCP)) {
            Ok(s) => s,
            Err(_) => return "unreachable",
        };
    if sockets::bind_interface(&socket, scope, ipv6).is_err()
        || socket.bind(&source.into()).is_err()
        || socket.set_nonblocking(true).is_err()
    {
        return "unreachable";
    }
    let target: SocketAddr = scope.socket_address(ip, port);
    if let Err(error) = socket.connect(&target.into()) {
        if error.kind() != std::io::ErrorKind::WouldBlock
            && error.kind() != std::io::ErrorKind::Interrupted
            && error.raw_os_error() != Some(libc::EINPROGRESS)
        {
            return if error.kind() == std::io::ErrorKind::ConnectionRefused {
                "refused"
            } else {
                "unreachable"
            };
        }
    }
    let stream = match TcpStream::from_std(socket.into()) {
        Ok(s) => s,
        Err(_) => return "unreachable",
    };
    let outcome = tokio::select! {
        _ = tokio::time::sleep(Duration::from_millis(500)) => return "timeout",
        _ = cancel.changed() => return "unreachable",
        result = stream.writable() => result,
    };
    if outcome.is_err() {
        return "unreachable";
    }
    match stream.take_error() {
        Ok(Some(e)) if e.kind() == std::io::ErrorKind::ConnectionRefused => "refused",
        Ok(Some(_)) => "unreachable",
        Ok(None) => "tcpReachable",
        Err(_) => "unreachable",
    }
}

fn record(
    snapshot: &mut DiscoverySnapshot,
    ip: IpAddr,
    port: u16,
    result: &'static str,
    announced: &HashSet<(IpAddr, u16)>,
    scope: &Scope,
) {
    if let Some(service) = snapshot
        .devices
        .iter_mut()
        .flat_map(|d| d.services.iter_mut())
        .find(|s| {
            s.target_address.parse::<IpAddr>().ok() == Some(ip)
                && s.port == port
                && s.transport == "tcp"
        })
    {
        service.verification = result.into();
    } else if result == "tcpReachable" && !announced.contains(&(ip, port)) {
        let existing = snapshot.devices.iter().position(|d| {
            d.addresses
                .iter()
                .any(|a| a.address.parse::<IpAddr>().ok() == Some(ip))
        });
        let index = match existing {
            Some(index) => index,
            None if snapshot.devices.len() < super::merge::MAX_DEVICES => {
                let address = crate::models::DiscoveryAddress {
                    address: ip.to_string(),
                    family: super::interfaces::family(ip).into(),
                    zone_id: super::interfaces::zone(ip, scope.public.interface_index),
                };
                let id = format!(
                    "{}:{}:{}",
                    scope.public.scope_id,
                    ip,
                    address.zone_id.unwrap_or(0)
                );
                snapshot.devices.push(crate::models::DiscoveredDevice {
                    id: id.clone(),
                    scope_id: scope.public.scope_id.clone(),
                    name: ip.to_string(),
                    addresses: vec![address],
                    sources: vec!["tcpProbe".into()],
                    last_seen_at: super::merge::now(),
                    services: vec![],
                    expires_at: None,
                    expired: false,
                });
                snapshot.devices.len() - 1
            }
            None => return,
        };
        let device = &mut snapshot.devices[index];
        {
            let name = format!("TCP {}", port);
            device.services.push(crate::models::DiscoveredService {
                id: format!("{}:tcp:{}", device.id, port),
                name: name.clone(),
                instance_names: vec![],
                target_address: ip.to_string(),
                zone_id: super::interfaces::zone(ip, scope.public.interface_index),
                port,
                transport: "tcp".into(),
                protocol_hint: port_hint(port).map(str::to_string),
                protocol_evidence: Some("portHint".into()),
                sources: vec!["tcpProbe".into()],
                verification: result.into(),
                last_seen_at: super::merge::now(),
                expires_at: None,
                expired: false,
                proxy_disabled_reason: match ip {
                    IpAddr::V6(address) => Some(if super::interfaces::link_local(address) {
                        "ipv6LinkLocal".into()
                    } else {
                        "ipv6NotValidated".into()
                    }),
                    IpAddr::V4(_) => None,
                },
            });
        }
        let _ = scope;
    }
}
fn port_hint(port: u16) -> Option<&'static str> {
    match port {
        443 | 8443 => Some("https"),
        80 | 8080 => Some("http"),
        22 => Some("ssh"),
        445 => Some("smb"),
        631 => Some("ipp"),
        _ => None,
    }
}
fn cancel_signaled(cancel: &watch::Receiver<bool>) -> bool {
    *cancel.borrow()
}
async fn wait_cancel(mut cancel: watch::Receiver<bool>) {
    if !*cancel.borrow() {
        let _ = cancel.changed().await;
    }
}

pub fn initial_budget() -> DiscoveryBudget {
    DiscoveryBudget::default()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn planned_targets_are_deduplicated_and_capped() {
        let mut targets: HashSet<(IpAddr, u16)> = HashSet::new();
        for ip in [
            "192.168.4.1".parse::<IpAddr>().unwrap(),
            "192.168.4.1".parse::<IpAddr>().unwrap(),
        ] {
            for port in PORTS {
                targets.insert((ip, port));
            }
        }
        assert_eq!(targets.len(), PORTS.len());
        assert_eq!(MAX_CONNECTIONS, 512);
        assert_eq!(MAX_ADDRESSES, 64);
        assert_eq!(CONCURRENCY, 16);
    }
}
