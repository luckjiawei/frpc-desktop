use crate::models::{DiscoveryInterfaceAddress, DiscoveryScope, DiscoveryScopes};
use netdev::ipnet::IpNet;
use sha2::{Digest, Sha256};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, SocketAddrV6};

#[derive(Clone)]
pub struct Scope {
    pub public: DiscoveryScope,
    pub interface_name: String,
    pub networks: Vec<IpNet>,
    pub fingerprint: String,
}

pub fn enumerate() -> Vec<Scope> {
    let mut scopes = Vec::new();
    for interface in netdev::get_interfaces() {
        if !interface.is_up()
            || !interface.is_running()
            || interface.is_loopback()
            || interface.index == 0
        {
            continue;
        }
        let mut networks: Vec<IpNet> = interface
            .ipv4
            .iter()
            .copied()
            .map(IpNet::V4)
            .chain(interface.ipv6.iter().copied().map(IpNet::V6))
            .filter(|n| permitted_unicast(n.addr()))
            .collect();
        networks.sort_by_key(ToString::to_string);
        networks.dedup();
        if networks.is_empty() {
            continue;
        }
        let virtual_name = format!(
            "{} {} {}",
            interface.name,
            interface.friendly_name.as_deref().unwrap_or(""),
            interface.description.as_deref().unwrap_or("")
        )
        .to_ascii_lowercase();
        let is_virtual = !interface.is_physical()
            || interface.is_point_to_point()
            || [
                "vpn",
                "tun",
                "tap",
                "docker",
                "veth",
                "virbr",
                "vmnet",
                "vbox",
                "bridge",
                "hyper-v",
                "tailscale",
                "zerotier",
            ]
            .iter()
            .any(|s| virtual_name.contains(s));
        // Include gateway identity so same-address route changes invalidate issued scopes.
        let fingerprint = format!(
            "{}:{}:{:?}:{:?}:{}",
            interface.index, interface.name, networks, interface.gateway, interface.default
        );
        let addresses = networks
            .iter()
            .map(|n| DiscoveryInterfaceAddress {
                address: n.addr().to_string(),
                family: family(n.addr()).into(),
                zone_id: zone(n.addr(), interface.index),
                prefix_length: n.prefix_len(),
            })
            .collect();
        scopes.push(Scope {
            public: DiscoveryScope {
                scope_id: String::new(),
                network_version: String::new(),
                name: super::merge::text(
                    interface
                        .friendly_name
                        .as_deref()
                        .unwrap_or(&interface.name),
                ),
                interface_index: interface.index,
                addresses,
                prefixes: networks.iter().map(|n| n.trunc().to_string()).collect(),
                is_default: interface.default && !is_virtual,
                is_virtual,
            },
            interface_name: interface.name,
            networks,
            fingerprint,
        });
    }
    scopes.sort_by_key(|s| s.public.interface_index);
    scopes.truncate(64);
    scopes
}

pub fn fingerprint(scopes: &[Scope]) -> String {
    let mut hash = Sha256::new();
    for scope in scopes {
        hash.update(scope.fingerprint.as_bytes());
        hash.update([0]);
    }
    format!("{:x}", hash.finalize())
}

pub fn public(scopes: &[Scope], version: &str) -> DiscoveryScopes {
    let default_scope_id = scopes
        .iter()
        .find(|s| s.public.is_default)
        .or_else(|| scopes.iter().find(|s| !s.public.is_virtual))
        .map(|s| s.public.scope_id.clone());
    DiscoveryScopes {
        scopes: scopes.iter().map(|s| s.public.clone()).collect(),
        default_scope_id,
        network_version: version.into(),
    }
}

pub fn family(ip: IpAddr) -> &'static str {
    if ip.is_ipv4() {
        "ipv4"
    } else {
        "ipv6"
    }
}
pub fn link_local(ip: Ipv6Addr) -> bool {
    ip.segments()[0] & 0xffc0 == 0xfe80
}
pub fn zone(ip: IpAddr, index: u32) -> Option<u32> {
    match ip {
        IpAddr::V6(ip) if link_local(ip) => Some(index),
        _ => None,
    }
}
pub fn permitted_unicast(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            (ip.is_private() || ip.is_link_local()) && !ip.is_broadcast() && !ip.is_unspecified()
        }
        // Only local/unique-local IPv6; global addresses are deliberately rejected.
        IpAddr::V6(ip) => {
            (link_local(ip) || ip.segments()[0] & 0xfe00 == 0xfc00) && ip.to_ipv4_mapped().is_none()
        }
    }
}

impl Scope {
    pub fn allows(&self, ip: IpAddr) -> bool {
        permitted_unicast(ip)
            && self.networks.iter().any(|n| {
                if !n.contains(&ip) {
                    return false;
                }
                match n {
                    IpNet::V4(n) if n.prefix_len() < 31 => {
                        ip != IpAddr::V4(n.network()) && ip != IpAddr::V4(n.broadcast())
                    }
                    _ => true,
                }
            })
    }
    pub fn source(&self, target: IpAddr) -> Option<SocketAddr> {
        self.networks
            .iter()
            .find(|n| n.contains(&target))
            .map(|n| self.socket_address(n.addr(), 0))
    }
    pub fn socket_address(&self, ip: IpAddr, port: u16) -> SocketAddr {
        match ip {
            IpAddr::V4(ip) => SocketAddr::new(ip.into(), port),
            IpAddr::V6(ip) => SocketAddr::V6(SocketAddrV6::new(
                ip,
                port,
                0,
                if link_local(ip) || ip.is_multicast() {
                    self.public.interface_index
                } else {
                    0
                },
            )),
        }
    }
    pub fn v4(&self) -> Option<Ipv4Addr> {
        self.networks.iter().find_map(|n| match n.addr() {
            IpAddr::V4(ip) => Some(ip),
            _ => None,
        })
    }
    pub fn v6(&self) -> Option<Ipv6Addr> {
        self.networks
            .iter()
            .find_map(|n| match n.addr() {
                IpAddr::V6(ip) if link_local(ip) => Some(ip),
                _ => None,
            })
            .or_else(|| {
                self.networks.iter().find_map(|n| match n.addr() {
                    IpAddr::V6(ip) => Some(ip),
                    _ => None,
                })
            })
    }
}

#[cfg(test)]
pub fn test_scope() -> Scope {
    Scope {
        public: DiscoveryScope {
            scope_id: "scope".into(),
            network_version: "version".into(),
            name: "test".into(),
            interface_index: 7,
            addresses: vec![],
            prefixes: vec![],
            is_default: true,
            is_virtual: false,
        },
        interface_name: "test0".into(),
        networks: vec![
            "192.168.4.2/24".parse().unwrap(),
            "fe80::1/64".parse().unwrap(),
            "fd00::1/64".parse().unwrap(),
        ],
        fingerprint: "test".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scope_rejects_external_broadcast_and_cross_link_targets() {
        let scope = test_scope();
        for address in [
            "8.8.8.8",
            "192.168.5.1",
            "192.168.4.0",
            "192.168.4.255",
            "127.0.0.1",
            "0.0.0.0",
            "224.0.0.251",
            "::1",
            "::ffff:192.168.4.3",
            "2001:db8::1",
            "fd01::1",
        ] {
            assert!(!scope.allows(address.parse().unwrap()), "{address}");
        }
        for address in ["192.168.4.3", "fe80::2", "fd00::2"] {
            assert!(scope.allows(address.parse().unwrap()));
        }
        assert_eq!(
            scope
                .socket_address("fe80::2".parse().unwrap(), 22)
                .to_string(),
            "[fe80::2%7]:22"
        );
    }
    #[test]
    fn system_interfaces_enumerate_with_bounded_stable_fingerprint() {
        let scopes = enumerate();
        assert!(scopes.len() <= 64);
        for scope in &scopes {
            assert!(!scope.public.addresses.is_empty());
            assert!(scope
                .networks
                .iter()
                .all(|network| permitted_unicast(network.addr())));
        }
        assert_eq!(fingerprint(&scopes), fingerprint(&enumerate()));
    }
}
