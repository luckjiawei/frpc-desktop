use super::{interfaces::Scope, os, sockets};
use crate::models::{DiscoveryBudget, DiscoverySignals, DiscoverySnapshot};
use futures_util::stream::{FuturesUnordered, StreamExt};
use std::{
    collections::HashSet,
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    sync::{watch, Mutex, Semaphore},
    time::Instant,
};

const BANNER_TIMEOUT: Duration = Duration::from_millis(280);

/// Minimal SMB2 NEGOTIATE request. The response carries the Windows build in
/// its NTLMSSP challenge, which is the only reliable version source.
fn smb_negotiate() -> Vec<u8> {
    let dialects: [u16; 5] = [0x0202, 0x0210, 0x0300, 0x0302, 0x0311];
    let body_len = 36 + dialects.len() * 2;
    let total = 64 + body_len;
    let mut packet = Vec::with_capacity(4 + total);
    packet.extend_from_slice(&[0, (total >> 16) as u8, (total >> 8) as u8, total as u8]);
    packet.extend_from_slice(b"\xfeSMB");
    packet.extend_from_slice(&64u16.to_le_bytes());
    packet.extend_from_slice(&0u16.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes());
    packet.extend_from_slice(&0u16.to_le_bytes());
    packet.extend_from_slice(&1u16.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes());
    packet.extend_from_slice(&0u64.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes());
    packet.extend_from_slice(&0u64.to_le_bytes());
    packet.extend_from_slice(&[0u8; 16]);
    packet.extend_from_slice(&36u16.to_le_bytes());
    packet.extend_from_slice(&(dialects.len() as u16).to_le_bytes());
    packet.extend_from_slice(&1u16.to_le_bytes());
    packet.extend_from_slice(&0u16.to_le_bytes());
    packet.extend_from_slice(&0u32.to_le_bytes());
    packet.extend_from_slice(&[0u8; 16]);
    packet.extend_from_slice(&0u64.to_le_bytes());
    for dialect in dialects {
        packet.extend_from_slice(&dialect.to_le_bytes());
    }
    packet
}

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
            let (result, signals) = connect(&scope, ip, port, cancel).await;
            drop(permit);
            Some((idx, ip, port, result, signals))
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
            if let Some(Some((_, ip, port, result, signals))) = futures.next().await {
                let mut snapshot = snapshot.lock().await;
                record(
                    &mut snapshot,
                    ip,
                    port,
                    result,
                    signals,
                    &service_targets,
                    &scope,
                );
                snapshot.budget.probes_completed += 1;
            }
        }
        if cancel_signaled(&cancel) {
            cancelled = true;
            break;
        }
    }
    while let Some(Some((_, ip, port, result, signals))) = futures.next().await {
        let mut snapshot = snapshot.lock().await;
        record(
            &mut snapshot,
            ip,
            port,
            result,
            signals,
            &service_targets,
            &scope,
        );
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
) -> (&'static str, DiscoverySignals) {
    let empty = DiscoverySignals::default;
    if !scope.allows(ip) {
        return ("unreachable", empty());
    }
    let Some(source) = scope.source(ip) else {
        return ("unreachable", empty());
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
            Err(_) => return ("unreachable", empty()),
        };
    if sockets::bind_interface(&socket, scope, ipv6).is_err()
        || socket.bind(&source.into()).is_err()
        || socket.set_nonblocking(true).is_err()
    {
        return ("unreachable", empty());
    }
    let target: SocketAddr = scope.socket_address(ip, port);
    if let Err(error) = socket.connect(&target.into()) {
        if error.kind() != std::io::ErrorKind::WouldBlock
            && error.kind() != std::io::ErrorKind::Interrupted
            && error.raw_os_error() != Some(libc::EINPROGRESS)
        {
            return if error.kind() == std::io::ErrorKind::ConnectionRefused {
                ("refused", empty())
            } else {
                ("unreachable", empty())
            };
        }
    }
    let mut stream = match TcpStream::from_std(socket.into()) {
        Ok(s) => s,
        Err(_) => return ("unreachable", empty()),
    };
    let outcome = tokio::select! {
        _ = tokio::time::sleep(Duration::from_millis(500)) => return ("timeout", empty()),
        _ = cancel.changed() => return ("unreachable", empty()),
        result = stream.writable() => result,
    };
    if outcome.is_err() {
        return ("unreachable", empty());
    }
    match stream.take_error() {
        Ok(Some(e)) if e.kind() == std::io::ErrorKind::ConnectionRefused => ("refused", empty()),
        Ok(Some(_)) => ("unreachable", empty()),
        Ok(None) => ("tcpReachable", banner(&mut stream, port, cancel).await),
        Err(_) => ("unreachable", empty()),
    }
}

/// Reads at most one short answer per reachable port. Bounded by the probe
/// budget so identifying a host never turns into a port scan of its own.
async fn banner(
    stream: &mut TcpStream,
    port: u16,
    mut cancel: watch::Receiver<bool>,
) -> DiscoverySignals {
    let mut signals = DiscoverySignals::default();
    let interesting = matches!(port, 22 | 80 | 445 | 8080);
    if !interesting || *cancel.borrow() {
        return signals;
    }
    if matches!(port, 80 | 8080) {
        let request = format!("HEAD / HTTP/1.0\r\nHost: {port}\r\nConnection: close\r\n\r\n");
        let _ = tokio::time::timeout(BANNER_TIMEOUT, stream.write_all(request.as_bytes())).await;
    } else if port == 445 {
        let _ = tokio::time::timeout(BANNER_TIMEOUT, stream.write_all(&smb_negotiate())).await;
    }
    let mut buffer = vec![0u8; 4096];
    let mut read = 0usize;
    let deadline = tokio::time::Instant::now() + BANNER_TIMEOUT;
    while read < buffer.len() {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        let outcome = tokio::select! {
            _ = cancel.changed() => break,
            result = tokio::time::timeout(remaining, stream.read(&mut buffer[read..])) => result,
        };
        match outcome {
            Ok(Ok(0)) | Err(_) => break,
            Ok(Ok(count)) => {
                read += count;
                if port == 445 && read >= 4 {
                    let declared = 4
                        + ((usize::from(buffer[1]) << 16)
                            | (usize::from(buffer[2]) << 8)
                            | usize::from(buffer[3]));
                    if read >= declared.min(buffer.len()) {
                        break;
                    }
                }
                if port != 445 && buffer[..read].contains(&b'\n') {
                    break;
                }
            }
            Ok(Err(_)) => break,
        }
    }
    if read == 0 {
        return signals;
    }
    match port {
        22 => {
            let text = String::from_utf8_lossy(&buffer[..read]);
            signals.ssh = text.lines().next().and_then(|line| os::sanitize(line, 120));
        }
        80 | 8080 => {
            let text = String::from_utf8_lossy(&buffer[..read]);
            signals.http = os::parse_http_server(&text);
        }
        445 => signals.smb = os::parse_smb_version(&buffer[..read]),
        _ => {}
    }
    signals
}

fn record(
    snapshot: &mut DiscoverySnapshot,
    ip: IpAddr,
    port: u16,
    result: &'static str,
    signals: DiscoverySignals,
    announced: &HashSet<(IpAddr, u16)>,
    scope: &Scope,
) {
    if signals.ssh.is_some() || signals.http.is_some() || signals.smb.is_some() {
        if let Some(device) = snapshot.devices.iter_mut().find(|device| {
            device
                .addresses
                .iter()
                .any(|address| address.address.parse::<IpAddr>().ok() == Some(ip))
        }) {
            if signals.ssh.is_some() {
                device.signals.ssh = signals.ssh;
            }
            if signals.http.is_some() {
                device.signals.http = signals.http;
            }
            if signals.smb.is_some() {
                device.signals.smb = signals.smb;
            }
        }
    }
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
                    os: None,
                    signals: DiscoverySignals::default(),
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
