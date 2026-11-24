use crate::models::{DiscoveredDevice, DiscoveryOs, DiscoveryOsEvidence, DiscoverySignals};

const MAX_EVIDENCE: usize = 4;

fn ev(kind: &str, value: impl Into<String>) -> DiscoveryOsEvidence {
    DiscoveryOsEvidence {
        kind: kind.into(),
        value: value.into(),
    }
}

fn profile(
    family: &str,
    name: &str,
    version: Option<String>,
    confidence: &str,
    mut evidence: Vec<DiscoveryOsEvidence>,
) -> Option<DiscoveryOs> {
    if evidence.is_empty() {
        return None;
    }
    evidence.truncate(MAX_EVIDENCE);
    Some(DiscoveryOs {
        family: family.into(),
        name: Some(name.into()),
        version,
        confidence: confidence.into(),
        evidence,
    })
}

/// Windows releases that can be derived from the SMB build number alone.
fn windows_release(build: u16) -> (&'static str, Option<String>) {
    let product = match build {
        26100..=26199 => "Windows 11",
        22631..=22635 => "Windows 11",
        22621..=22630 => "Windows 11",
        22000..=22099 => "Windows 11",
        19041..=19045 => "Windows 10",
        18362..=18363 => "Windows 10",
        17763..=17763 => "Windows 10 / Server 2019",
        17134..=17134 => "Windows 10",
        16299..=16299 => "Windows 10",
        15063..=15063 => "Windows 10",
        14393..=14393 => "Windows 10 / Server 2016",
        10240..=10586 => "Windows 10",
        9600..=9600 => "Windows 8.1 / Server 2012 R2",
        9200..=9200 => "Windows 8 / Server 2012",
        7600..=7601 => "Windows 7 / Server 2008 R2",
        _ => "Windows",
    };
    let release = match build {
        26100..=26199 => Some("24H2"),
        22631..=22635 => Some("23H2"),
        22621..=22630 => Some("22H2"),
        22000..=22099 => Some("21H2"),
        19045..=19045 => Some("22H2"),
        19044..=19044 => Some("21H2"),
        19043..=19043 => Some("21H1"),
        19042..=19042 => Some("20H2"),
        19041..=19041 => Some("2004"),
        18363..=18363 => Some("1909"),
        17763..=17763 => Some("1809"),
        17134..=17134 => Some("1803"),
        16299..=16299 => Some("1709"),
        15063..=15063 => Some("1703"),
        14393..=14393 => Some("1607"),
        _ => None,
    }
    .map(str::to_string);
    (product, release)
}

/// Reads the NTLMSSP challenge inside an SMB2 NEGOTIATE response and returns the
/// version the server reported about itself.
pub fn parse_smb_version(packet: &[u8]) -> Option<(u8, u8, u16)> {
    if packet.len() < 4 + 64 || &packet[4..8] != b"\xfeSMB" {
        return None;
    }
    let header = 4;
    let status = u32::from_le_bytes(packet.get(header + 8..header + 12)?.try_into().ok()?);
    if status != 0 {
        return None;
    }
    let body = header + 64;
    let offset = usize::from(u16::from_le_bytes(
        packet.get(body + 56..body + 58)?.try_into().ok()?,
    ));
    let length = usize::from(u16::from_le_bytes(
        packet.get(body + 58..body + 60)?.try_into().ok()?,
    ));
    if offset < 64 || length == 0 {
        return None;
    }
    let security = packet.get(header + offset..header + offset + length)?;
    let ntlm = find(security, b"NTLMSSP\0")?;
    let challenge = security.get(ntlm..)?;
    let kind = u32::from_le_bytes(challenge.get(8..12)?.try_into().ok()?);
    if kind != 2 {
        return None;
    }
    let flags = u32::from_le_bytes(challenge.get(20..24)?.try_into().ok()?);
    // NTLMSSP_NEGOTIATE_VERSION
    if flags & 0x0200_0000 == 0 || challenge.len() < 56 {
        return None;
    }
    let major = *challenge.get(48)?;
    let minor = *challenge.get(49)?;
    let build = u16::from_le_bytes(challenge.get(50..52)?.try_into().ok()?);
    if major == 0 && minor == 0 && build == 0 {
        return None;
    }
    Some((major, minor, build))
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

/// Extracts the `Server` header from an HTTP response, bounded to headers only.
pub fn parse_http_server(head: &str) -> Option<String> {
    head.lines().take(32).find_map(|line| {
        let (key, value) = line.split_once(':')?;
        key.trim()
            .eq_ignore_ascii_case("server")
            .then(|| sanitize(value, 96))
            .flatten()
    })
}

/// Device software clues that name an operating system directly.
pub fn parse_ssh_banner(banner: &str) -> Option<(&'static str, &'static str, &'static str)> {
    let lower = banner.to_ascii_lowercase();
    if !lower.contains("ssh-") && !lower.contains("openssh") && !lower.contains("dropbear") {
        return None;
    }
    if lower.contains("openssh_for_windows") {
        return Some(("windows", "Windows", "medium"));
    }
    if lower.contains("ubuntu") {
        return Some(("ubuntu", "Ubuntu", "medium"));
    }
    if lower.contains("debian") {
        return Some(("debian", "Debian", "medium"));
    }
    if lower.contains("raspbian") {
        return Some(("debian", "Raspbian", "medium"));
    }
    if lower.contains("freebsd") {
        return Some(("linux", "FreeBSD", "medium"));
    }
    if lower.contains("dropbear") {
        return Some(("linux", "Linux", "medium"));
    }
    None
}

fn http_family(server: &str) -> Option<(&'static str, &'static str)> {
    let lower = server.to_ascii_lowercase();
    if lower.contains("(ubuntu)") || lower.contains("ubuntu") {
        return Some(("ubuntu", "Ubuntu"));
    }
    if lower.contains("(debian)") || lower.contains("debian") {
        return Some(("debian", "Debian"));
    }
    if lower.contains("microsoft-iis") || lower.contains("microsoft-httpapi") {
        return Some(("windows", "Windows"));
    }
    if lower.contains("win32") || lower.contains("win64") {
        return Some(("windows", "Windows"));
    }
    if lower.contains("darwin") || lower.contains("macos") {
        return Some(("macos", "macOS"));
    }
    None
}

pub fn sanitize(value: &str, limit: usize) -> Option<String> {
    let cleaned: String = value
        .chars()
        .filter(|c| !c.is_control())
        .take(limit)
        .collect();
    let trimmed = cleaned.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn port_opens(device: &DiscoveredDevice, port: u16) -> bool {
    device.services.iter().any(|service| {
        service.port == port && service.transport == "tcp" && service.verification == "tcpReachable"
    })
}

fn has_port(device: &DiscoveredDevice, port: u16) -> bool {
    device
        .services
        .iter()
        .any(|service| service.port == port && service.transport == "tcp")
}

/// Clarifies what could not be identified, so the UI never guesses silently.
pub fn finalize(device: &mut DiscoveredDevice) {
    let signals: DiscoverySignals = device.signals.clone();
    let mut evidence = Vec::new();

    if let Some((major, minor, build)) = signals.smb {
        if major == 10 || major == 6 {
            let (product, release) = windows_release(build);
            evidence.push(evidence_for_smb(&format!("{major}.{minor}.{build}")));
            device.os = profile("windows", product, release, "high", evidence);
            return;
        }
        evidence.push(evidence_for_smb(&format!("{major}.{minor}.{build}")));
    }

    if let Some(banner) = signals.ssh.as_deref() {
        if let Some((family, name, confidence)) = parse_ssh_banner(banner) {
            evidence.push(ev("ssh", banner.to_string()));
            if family == "macos"
                || (has_port(device, 5900) && device.name.to_ascii_lowercase().contains("mac"))
            {
                device.os = profile("macos", "macOS", None, confidence, evidence.clone());
            } else if matches!(family, "windows" | "ubuntu" | "debian" | "linux") {
                device.os = profile(family, name, None, confidence, evidence.clone());
            }
            if device.os.is_some() {
                return;
            }
        } else if sanitize(banner, 96).is_some() {
            evidence.push(ev("ssh", banner.to_string()));
        }
    }

    if let Some(server) = signals.http.as_deref() {
        if let Some((family, name)) = http_family(server) {
            evidence.push(ev("http", server.to_string()));
            device.os = profile(family, name, None, "medium", evidence);
            return;
        }
        if let Some(clean) = sanitize(server, 96) {
            evidence.push(ev("http", clean));
        }
    }

    if let Some(server) = signals.ssdp.as_deref() {
        let lower = server.to_ascii_lowercase();
        let family = if lower.contains("windows") {
            Some(("windows", "Windows"))
        } else if lower.contains("darwin") || lower.contains("mac os") {
            Some(("macos", "macOS"))
        } else if lower.contains("ubuntu") {
            Some(("ubuntu", "Ubuntu"))
        } else if lower.contains("debian") {
            Some(("debian", "Debian"))
        } else if lower.contains("linux") {
            Some(("linux", "Linux"))
        } else {
            None
        };
        evidence.push(ev("ssdp", server.to_string()));
        if let Some((family, name)) = family {
            device.os = profile(family, name, None, "low", evidence);
            return;
        }
    }

    // Port combinations only name the broad family; never a version.
    if port_opens(device, 3389) {
        evidence.push(ev(
            "ports",
            if has_port(device, 445) {
                "同时开放 445 / 3389"
            } else {
                "开放 3389"
            }
            .to_string(),
        ));
        device.os = profile("windows", "Windows", None, "low", evidence);
        return;
    }
    if port_opens(device, 548) {
        evidence.push(ev("ports", "开放 548".to_string()));
        device.os = profile("macos", "macOS", None, "low", evidence);
        return;
    }

    // Keep the collected clues visible even when no family could be named.
    if !evidence.is_empty() {
        evidence.truncate(MAX_EVIDENCE);
        device.os = Some(DiscoveryOs {
            family: "unknown".into(),
            name: None,
            version: None,
            confidence: "low".into(),
            evidence,
        });
    }
}

fn evidence_for_smb(version: &str) -> DiscoveryOsEvidence {
    ev("smb", format!("系统标识 {version}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discovery::interfaces;
    use crate::models::DiscoveryAddress;

    fn device() -> DiscoveredDevice {
        let scope = interfaces::test_scope();
        DiscoveredDevice {
            id: "d".into(),
            scope_id: scope.public.scope_id.clone(),
            name: "host".into(),
            addresses: vec![DiscoveryAddress {
                address: "192.168.1.5".into(),
                family: "ipv4".into(),
                zone_id: None,
            }],
            sources: vec!["mdns".into()],
            last_seen_at: String::new(),
            services: vec![],
            expires_at: None,
            expired: false,
            os: None,
            signals: DiscoverySignals::default(),
        }
    }

    fn service(port: u16, verification: &str) -> crate::models::DiscoveredService {
        crate::models::DiscoveredService {
            id: format!("s{port}"),
            name: String::new(),
            instance_names: vec![],
            target_address: "192.168.1.5".into(),
            zone_id: None,
            port,
            transport: "tcp".into(),
            protocol_hint: None,
            protocol_evidence: None,
            sources: vec!["tcpProbe".into()],
            verification: verification.into(),
            last_seen_at: String::new(),
            expires_at: None,
            expired: false,
            proxy_disabled_reason: None,
        }
    }

    #[test]
    fn smb_build_maps_to_windows_release() {
        let mut item = device();
        item.signals.smb = Some((10, 0, 22631));
        finalize(&mut item);
        let os = item.os.unwrap();
        assert_eq!(os.family, "windows");
        assert_eq!(os.name.as_deref(), Some("Windows 11"));
        // The build number stays in the evidence; the title only shows the release.
        assert_eq!(os.version.as_deref(), Some("23H2"));
        assert_eq!(os.confidence, "high");
    }

    #[test]
    fn ssh_banner_names_distro_without_version() {
        let mut item = device();
        item.signals.ssh = Some("SSH-2.0-OpenSSH_9.6p1 Debian-3".into());
        finalize(&mut item);
        let os = item.os.unwrap();
        assert_eq!(os.family, "debian");
        assert_eq!(os.version, None);
        assert_eq!(os.confidence, "medium");
    }

    #[test]
    fn port_combo_is_low_confidence_and_versionless() {
        let mut item = device();
        item.services = vec![service(3389, "tcpReachable")];
        finalize(&mut item);
        let os = item.os.unwrap();
        assert_eq!(os.family, "windows");
        assert_eq!(os.version, None);
        assert_eq!(os.confidence, "low");
    }

    #[test]
    fn closed_ports_do_not_identify() {
        let mut item = device();
        item.services = vec![service(3389, "refused")];
        finalize(&mut item);
        assert!(item.os.is_none());
    }

    #[test]
    fn http_server_header_is_parsed() {
        let head = "HTTP/1.1 200 OK\r\nServer: nginx/1.24.0 (Ubuntu)\r\n\r\n";
        assert_eq!(
            parse_http_server(head).as_deref(),
            Some("nginx/1.24.0 (Ubuntu)")
        );
        assert_eq!(parse_http_server("HTTP/1.1 200 OK\r\n"), None);
    }

    #[test]
    fn smb_parser_rejects_short_or_non_smb_packets() {
        assert_eq!(parse_smb_version(b""), None);
        assert_eq!(parse_smb_version(b"\x00\x00\x00\x10nope"), None);
    }
}
