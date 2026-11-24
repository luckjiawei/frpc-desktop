use super::{interfaces::Scope, merge::Observation, SourceReport};
use std::net::IpAddr;
use tokio::sync::{mpsc, watch};

pub async fn collect(
    scope: Scope,
    tx: mpsc::Sender<Observation>,
    cancel: watch::Receiver<bool>,
) -> SourceReport {
    let result = platform(&scope, cancel).await;
    match result {
        Ok((entries, limited)) => {
            let mut limited = limited;
            for (address, stale) in entries {
                if tx
                    .try_send(Observation {
                        address,
                        name: String::new(),
                        source: "neighbor",
                        ttl: if stale { Some(0) } else { None },
                        service: None,
                    })
                    .is_err()
                {
                    limited = true;
                }
            }
            SourceReport {
                source: "neighbor",
                available: true,
                limited,
                reason: None,
            }
        }
        Err(reason) => SourceReport {
            source: "neighbor",
            available: false,
            limited: false,
            reason: Some(reason),
        },
    }
}

#[cfg(not(target_os = "windows"))]
async fn command(
    path: &str,
    args: &[&str],
    mut cancel: watch::Receiver<bool>,
) -> Result<String, &'static str> {
    use std::{process::Stdio, time::Duration};
    use tokio::io::AsyncReadExt;
    let mut child = tokio::process::Command::new(path)
        .args(args)
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| "commandUnavailable")?;
    let mut stdout = child.stdout.take().ok_or("commandFailed")?.take(262145);
    let mut bytes = Vec::new();
    let read = tokio::select! {
        _ = cancel.changed() => Err("cancelled"),
        result = tokio::time::timeout(Duration::from_secs(2), stdout.read_to_end(&mut bytes)) => match result { Ok(Ok(_)) if bytes.len() <= 262144 => Ok(()), Ok(Ok(_)) => Err("outputLimit"), Ok(Err(_)) => Err("commandFailed"), Err(_) => Err("commandTimedOut") },
    };
    if let Err(reason) = read {
        let _ = child.kill().await;
        let _ = child.wait().await;
        return Err(reason);
    }
    let status = tokio::select! { _ = cancel.changed() => None, result = tokio::time::timeout(Duration::from_secs(1), child.wait()) => result.ok().and_then(Result::ok) };
    match status {
        Some(status) if status.success() => Ok(String::from_utf8_lossy(&bytes).into_owned()),
        _ => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            Err("commandFailed")
        }
    }
}

#[cfg(target_os = "macos")]
async fn platform(
    scope: &Scope,
    cancel: watch::Receiver<bool>,
) -> Result<(Vec<(IpAddr, bool)>, bool), &'static str> {
    let (arp, ndp) = tokio::join!(
        command("/usr/sbin/arp", &["-an"], cancel.clone()),
        command("/usr/sbin/ndp", &["-an"], cancel)
    );
    if arp.is_err() && ndp.is_err() {
        return Err("commandUnavailable");
    }
    let partial = arp.is_err() || ndp.is_err();
    let mut entries = Vec::new();
    if let Ok(output) = arp {
        entries.extend(parse_macos_arp(&output, &scope.interface_name));
    }
    if let Ok(output) = ndp {
        entries.extend(parse_macos_ndp(&output, &scope.interface_name));
    }
    let limited = partial || entries.len() > 2048;
    entries.truncate(2048);
    Ok((entries, limited))
}

#[cfg(any(target_os = "macos", test))]
fn parse_macos_arp(output: &str, interface: &str) -> Vec<(IpAddr, bool)> {
    output
        .lines()
        .take(4096)
        .filter_map(|line| {
            let fields: Vec<_> = line.split_whitespace().take(32).collect();
            let on = fields.iter().position(|field| *field == "on")?;
            if *fields.get(on + 1)? != interface || fields.contains(&"(incomplete)") {
                return None;
            }
            let address = fields.iter().find_map(|f| {
                f.strip_prefix('(')?
                    .strip_suffix(')')?
                    .parse::<IpAddr>()
                    .ok()
            })?;
            Some((address, false))
        })
        .collect()
}
#[cfg(any(target_os = "macos", test))]
fn parse_macos_ndp(output: &str, interface: &str) -> Vec<(IpAddr, bool)> {
    output
        .lines()
        .take(4096)
        .filter_map(|line| {
            let fields: Vec<_> = line.split_whitespace().take(32).collect();
            if fields.len() < 5 || fields[2] != interface || fields[1] == "(incomplete)" {
                return None;
            }
            let (address, zone) = fields[0].split_once('%').unwrap_or((fields[0], interface));
            if zone != interface {
                return None;
            }
            Some((address.parse().ok()?, fields[4] == "S"))
        })
        .collect()
}

#[cfg(target_os = "linux")]
async fn platform(
    scope: &Scope,
    cancel: watch::Receiver<bool>,
) -> Result<(Vec<(IpAddr, bool)>, bool), &'static str> {
    let path = ["/usr/sbin/ip", "/sbin/ip", "/usr/bin/ip", "/bin/ip"]
        .into_iter()
        .find(|path| std::path::Path::new(path).is_file())
        .ok_or("commandUnavailable")?;
    let output = command(
        path,
        &["-j", "neigh", "show", "dev", &scope.interface_name],
        cancel,
    )
    .await?;
    parse_linux(&output, &scope.interface_name)
}
#[cfg(any(target_os = "linux", test))]
fn parse_linux(output: &str, interface: &str) -> Result<(Vec<(IpAddr, bool)>, bool), &'static str> {
    let value: Vec<serde_json::Value> =
        serde_json::from_str(output).map_err(|_| "commandFailed")?;
    let limited = value.len() > 2048;
    let entries = value
        .into_iter()
        .take(2048)
        .filter_map(|entry| {
            if entry
                .get("dev")
                .and_then(|v| v.as_str())
                .is_some_and(|dev| dev != interface)
            {
                return None;
            }
            let states = entry.get("state")?.as_array()?;
            if states
                .iter()
                .any(|s| matches!(s.as_str(), Some("FAILED" | "INCOMPLETE" | "NOARP")))
            {
                return None;
            }
            let stale = states.iter().any(|s| s.as_str() == Some("STALE"));
            Some((entry.get("dst")?.as_str()?.parse().ok()?, stale))
        })
        .collect();
    Ok((entries, limited))
}

#[cfg(target_os = "windows")]
async fn platform(
    scope: &Scope,
    _cancel: watch::Receiver<bool>,
) -> Result<(Vec<(IpAddr, bool)>, bool), &'static str> {
    let index = scope.public.interface_index;
    // Await this native call even on cancellation; no replacement task starts
    // before the OS table and blocking worker have actually been released.
    tokio::task::spawn_blocking(move || {
        use windows_sys::Win32::{NetworkManagement::IpHelper::*, Networking::WinSock::*};
        let mut table: *mut MIB_IPNET_TABLE2 = std::ptr::null_mut();
        let result = unsafe { GetIpNetTable2(AF_UNSPEC, &mut table) };
        if result != 0 || table.is_null() {
            return Err("interfaceUnavailable");
        }
        struct Table(*mut MIB_IPNET_TABLE2);
        impl Drop for Table {
            fn drop(&mut self) {
                unsafe {
                    FreeMibTable(self.0.cast());
                }
            }
        }
        let table = Table(table);
        let count = unsafe { (*table.0).NumEntries as usize };
        let rows =
            unsafe { std::slice::from_raw_parts((*table.0).Table.as_ptr(), count.min(65536)) };
        let mut entries = Vec::new();
        for row in rows {
            if row.InterfaceIndex != index || matches!(row.State, 0 | 1) {
                continue;
            }
            let address = unsafe {
                match row.Address.si_family {
                    AF_INET => IpAddr::V4(std::net::Ipv4Addr::from(
                        row.Address.Ipv4.sin_addr.S_un.S_addr.to_ne_bytes(),
                    )),
                    AF_INET6 => {
                        IpAddr::V6(std::net::Ipv6Addr::from(row.Address.Ipv6.sin6_addr.u.Byte))
                    }
                    _ => continue,
                }
            };
            entries.push((address, row.State == 4));
            if entries.len() >= 2048 {
                break;
            }
        }
        let limited = count > 65536 || entries.len() >= 2048;
        Ok((entries, limited))
    })
    .await
    .map_err(|_| "interfaceUnavailable")?
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
async fn platform(
    _scope: &Scope,
    _cancel: watch::Receiver<bool>,
) -> Result<(Vec<(IpAddr, bool)>, bool), &'static str> {
    Err("interfaceUnavailable")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn neighbor_tables_filter_interfaces_incomplete_and_stale() {
        let arp = "? (192.168.4.5) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]\n? (192.168.4.6) at (incomplete) on en0 ifscope [ethernet]\n? (192.168.4.7) at aa:bb:cc:dd:ee:ff on en1 ifscope [ethernet]";
        assert_eq!(parse_macos_arp(arp, "en0").len(), 1);
        let ndp = "fe80::2%en0 aa:bb:cc:dd:ee:ff en0 23h59m S\nfe80::2%en1 aa:bb:cc:dd:ee:ff en1 23h59m R";
        assert_eq!(
            parse_macos_ndp(ndp, "en0"),
            vec![("fe80::2".parse().unwrap(), true)]
        );
        let json = r#"[{"dst":"192.168.4.2","dev":"eth0","state":["STALE"]},{"dst":"192.168.4.3","dev":"eth0","state":["FAILED"]},{"dst":"192.168.4.4","dev":"eth1","state":["REACHABLE"]}]"#;
        assert_eq!(
            parse_linux(json, "eth0").unwrap().0,
            vec![("192.168.4.2".parse().unwrap(), true)]
        );
    }
}
