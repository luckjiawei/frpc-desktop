use super::interfaces::{self, Scope};
use crate::models::*;
use chrono::{Duration, Utc};
use std::net::IpAddr;

pub const MAX_DEVICES: usize = 1000;
pub const MAX_SERVICES: usize = 5000;
pub const MAX_SNAPSHOT_BYTES: usize = 2 * 1024 * 1024 - 1024;

#[derive(Clone, Debug)]
pub struct Service {
    pub name: String,
    pub port: u16,
    pub transport: &'static str,
    pub hint: Option<String>,
}
#[derive(Clone, Debug)]
pub struct Observation {
    pub address: IpAddr,
    pub name: String,
    pub source: &'static str,
    pub ttl: Option<u32>,
    pub service: Option<Service>,
}

pub fn text(s: &str) -> String {
    s.chars().filter(|c| !c.is_control()).take(128).collect()
}
pub fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
fn expiry(ttl: Option<u32>) -> Option<String> {
    ttl.map(|ttl| {
        (Utc::now() + Duration::seconds(i64::from(ttl.min(86400))))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
    })
}
fn add_source(sources: &mut Vec<String>, source: &str) {
    if !sources.iter().any(|s| s == source) {
        sources.push(source.into());
    }
}
pub fn warn(snapshot: &mut DiscoverySnapshot, reason: &str) {
    snapshot.partial = true;
    if snapshot.warnings.len() < 32 && !snapshot.warnings.iter().any(|w| w == reason) {
        snapshot.warnings.push(reason.into());
    }
}
pub fn truncated(snapshot: &mut DiscoverySnapshot, reason: &str) {
    snapshot.truncated = true;
    warn(snapshot, reason);
}

pub fn observe(snapshot: &mut DiscoverySnapshot, scope: &Scope, item: Observation) {
    if !scope.allows(item.address) {
        snapshot.budget.rejected_addresses += 1;
        return;
    }
    let addr = item.address.to_string();
    let id = format!(
        "{}:{}:{}",
        scope.public.scope_id,
        addr,
        interfaces::zone(item.address, scope.public.interface_index).unwrap_or(0)
    );
    let position = snapshot.devices.iter().position(|d| d.id == id);
    if position.is_none() && snapshot.devices.len() >= MAX_DEVICES {
        truncated(snapshot, "deviceLimit");
        return;
    }
    let index = position.unwrap_or_else(|| {
        snapshot.devices.push(DiscoveredDevice {
            id: id.clone(),
            scope_id: scope.public.scope_id.clone(),
            name: addr.clone(),
            addresses: vec![DiscoveryAddress {
                address: addr.clone(),
                family: interfaces::family(item.address).into(),
                zone_id: interfaces::zone(item.address, scope.public.interface_index),
            }],
            sources: Vec::new(),
            last_seen_at: now(),
            services: Vec::new(),
            expires_at: expiry(item.ttl),
            expired: item.ttl == Some(0),
        });
        snapshot.devices.len() - 1
    });
    let total_services: usize = snapshot.devices.iter().map(|d| d.services.len()).sum();
    let device = &mut snapshot.devices[index];
    if !item.name.is_empty() {
        device.name = text(&item.name);
    }
    add_source(&mut device.sources, item.source);
    device.last_seen_at = now();
    device.expires_at = expiry(item.ttl);
    device.expired = item.ttl == Some(0);
    let Some(service) = item.service else {
        return;
    };
    if service.port == 0 || !matches!(service.transport, "tcp" | "udp") {
        return;
    }
    let service_id = format!("{}:{}:{}", id, service.transport, service.port);
    let existing = device.services.iter_mut().find(|s| s.id == service_id);
    if let Some(existing) = existing {
        add_source(&mut existing.sources, item.source);
        if !service.name.is_empty() {
            let name = text(&service.name);
            if existing.instance_names.len() < 8 && !existing.instance_names.contains(&name) {
                existing.instance_names.push(name.clone());
            }
            existing.name = name;
        }
        if service.hint.is_some() && item.source != "probe" {
            existing.protocol_hint = service.hint.map(|s| text(&s));
            existing.protocol_evidence = Some("announcement".into());
        }
        existing.last_seen_at = now();
        existing.expires_at = expiry(item.ttl);
        existing.expired = item.ttl == Some(0);
        existing.proxy_disabled_reason = disabled(item.address, existing.expired);
    } else {
        if total_services >= MAX_SERVICES {
            truncated(snapshot, "serviceLimit");
            return;
        }
        let name = text(&service.name);
        snapshot.devices[index].services.push(DiscoveredService {
            id: service_id,
            name: name.clone(),
            instance_names: if name.is_empty() { vec![] } else { vec![name] },
            target_address: addr,
            zone_id: interfaces::zone(item.address, scope.public.interface_index),
            port: service.port,
            transport: service.transport.into(),
            protocol_hint: service.hint.map(|s| text(&s)),
            protocol_evidence: Some(
                if item.source == "probe" {
                    "portHint"
                } else {
                    "announcement"
                }
                .into(),
            ),
            sources: vec![item.source.into()],
            verification: "notChecked".into(),
            last_seen_at: now(),
            expires_at: expiry(item.ttl),
            expired: item.ttl == Some(0),
            proxy_disabled_reason: disabled(item.address, item.ttl == Some(0)),
        });
    }
}

fn disabled(ip: IpAddr, expired: bool) -> Option<String> {
    if expired {
        Some("expired".into())
    } else {
        match ip {
            IpAddr::V6(ip) => Some(
                if interfaces::link_local(ip) {
                    "ipv6LinkLocal"
                } else {
                    "ipv6NotValidated"
                }
                .into(),
            ),
            _ => None,
        }
    }
}
pub fn expire(snapshot: &mut DiscoverySnapshot) {
    let current = now();
    for device in &mut snapshot.devices {
        if device
            .expires_at
            .as_ref()
            .is_some_and(|expiry| expiry <= &current)
        {
            device.expired = true;
        }
        for service in &mut device.services {
            if service
                .expires_at
                .as_ref()
                .is_some_and(|expiry| expiry <= &current)
            {
                service.expired = true;
                service.proxy_disabled_reason = Some("expired".into());
            }
        }
    }
}

// Trim the owned snapshot, not just event serialization, so recovery has the same bound.
pub fn bound(snapshot: &mut DiscoverySnapshot) {
    expire(snapshot);
    while serde_json::to_vec(snapshot)
        .map(|s| s.len())
        .unwrap_or(usize::MAX)
        > MAX_SNAPSHOT_BYTES
    {
        truncated(snapshot, "snapshotLimit");
        if let Some(device) = snapshot.devices.last_mut() {
            if device.services.is_empty() {
                snapshot.devices.pop();
            } else {
                device.services.pop();
            }
        } else {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_are_bounded_and_control_free() {
        assert_eq!(text("a\n\0b"), "ab");
        assert_eq!(text(&"猫".repeat(200)).chars().count(), 128);
    }
    #[test]
    fn sources_and_ports_deduplicate_without_merging_names() {
        let scope = interfaces::test_scope();
        let mut snapshot = super::super::new_snapshot("request", &scope);
        let mut item = Observation {
            address: "192.168.4.9".parse().unwrap(),
            name: "same name".into(),
            source: "mdns",
            ttl: Some(120),
            service: Some(Service {
                name: "printer".into(),
                port: 631,
                transport: "tcp",
                hint: Some("ipp".into()),
            }),
        };
        observe(&mut snapshot, &scope, item.clone());
        observe(&mut snapshot, &scope, item.clone());
        assert_eq!(snapshot.devices[0].services.len(), 1);
        item.address = "192.168.4.10".parse().unwrap();
        observe(&mut snapshot, &scope, item.clone());
        assert_eq!(snapshot.devices.len(), 2);
        item.ttl = Some(0);
        observe(&mut snapshot, &scope, item);
        assert!(snapshot.devices[1].services[0].expired);
        assert_eq!(
            snapshot.devices[1].services[0]
                .proxy_disabled_reason
                .as_deref(),
            Some("expired")
        );
    }
}
