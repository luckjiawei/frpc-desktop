use super::{interfaces::Scope, merge::Observation, sockets, SourceReport};
use std::time::Duration;
use tokio::{
    sync::{mpsc, watch},
    time::Instant,
};

#[derive(Debug)]
struct Advertisement {
    name: String,
    ttl: u32,
}
fn parse(packet: &[u8]) -> Option<Advertisement> {
    if packet.len() > 8192 {
        return None;
    }
    let text = std::str::from_utf8(packet).ok()?;
    if text.contains('\0') {
        return None;
    }
    let mut lines = text.split("\r\n");
    let first = lines.next()?;
    if first != "HTTP/1.1 200 OK" && first != "NOTIFY * HTTP/1.1" {
        return None;
    }
    let mut name = None;
    let mut ttl = 1800;
    let mut goodbye = false;
    for (index, line) in lines.enumerate() {
        if line.is_empty() {
            break;
        }
        if index >= 64 || line.len() > 1024 {
            return None;
        }
        let (key, value) = line.split_once(':')?;
        let value = value.trim();
        match key.to_ascii_lowercase().as_str() {
            "st" | "nt" if name.is_none() => name = Some(super::merge::text(value)),
            "cache-control" => {
                for directive in value.split(',') {
                    if let Some((key, value)) = directive.trim().split_once('=') {
                        if key.trim().eq_ignore_ascii_case("max-age") {
                            ttl = value.trim().parse::<u32>().ok()?.min(86400);
                        }
                    }
                }
            }
            "nts" if value.eq_ignore_ascii_case("ssdp:byebye") => goodbye = true,
            _ => {}
        }
    }
    Some(Advertisement {
        name: name.filter(|n| !n.is_empty())?,
        ttl: if goodbye { 0 } else { ttl },
    })
}
pub async fn collect(
    scope: Scope,
    tx: mpsc::Sender<Observation>,
    cancel: watch::Receiver<bool>,
) -> SourceReport {
    let (a, b) = tokio::join!(
        family(&scope, &tx, false, cancel.clone()),
        family(&scope, &tx, true, cancel)
    );
    SourceReport::combine("ssdp", a, b)
}
async fn family(
    scope: &Scope,
    tx: &mpsc::Sender<Observation>,
    ipv6: bool,
    mut cancel: watch::Receiver<bool>,
) -> Result<bool, &'static str> {
    if (ipv6 && scope.v6().is_none()) || (!ipv6 && scope.v4().is_none()) {
        return Err("addressFamilyUnavailable");
    }
    let (socket, destination) =
        sockets::udp(scope, ipv6, false).map_err(|_| "socketUnavailable")?;
    let host = if ipv6 {
        "[FF02::C]:1900"
    } else {
        "239.255.255.250:1900"
    };
    let message=format!("M-SEARCH * HTTP/1.1\r\nHOST: {host}\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n");
    tokio::select! {_=cancel.changed()=>return Err("cancelled"),result=socket.send_to(message.as_bytes(),destination)=>{result.map_err(|_|"sendFailed")?;}}
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut packet = [0u8; 8193];
    let mut packets = 0;
    let mut limited = false;
    loop {
        let received = tokio::select! {_=cancel.changed()=>return Err("cancelled"),result=tokio::time::timeout_at(deadline,socket.recv_from(&mut packet))=>match result{Ok(Ok(v))=>v,Ok(Err(_))=>return Err("receiveFailed"),Err(_)=>break}};
        let (len, sender) = received;
        packets += 1;
        if packets > 2048 {
            limited = true;
            break;
        }
        if !scope.allows(sender.ip()) {
            continue;
        }
        if let Some(ad) = parse(&packet[..len]) {
            if tx
                .try_send(Observation {
                    address: sender.ip(),
                    name: ad.name,
                    source: "ssdp",
                    ttl: Some(ad.ttl),
                    service: None,
                })
                .is_err()
            {
                limited = true;
            }
        }
    }
    Ok(limited)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ssdp_ignores_location_and_never_creates_service() {
        let value=parse(b"HTTP/1.1 200 OK\r\nST: urn:device:printer\r\nLOCATION: http://8.8.8.8/private\r\nCACHE-CONTROL: max-age=45\r\n\r\n").unwrap();
        assert_eq!(value.name, "urn:device:printer");
        assert_eq!(value.ttl, 45);
        let goodbye =
            parse(b"NOTIFY * HTTP/1.1\r\nNT: upnp:rootdevice\r\nNTS: ssdp:byebye\r\n\r\n").unwrap();
        assert_eq!(goodbye.ttl, 0);
    }
    #[test]
    fn malformed_or_large_responses_are_rejected() {
        assert!(parse(b"HTTP/1.1 200 OK\r\nST broken\r\n\r\n").is_none());
        assert!(parse(&vec![b'x'; 8193]).is_none());
        assert!(parse(b"HTTP/1.1 200 OK\r\nST: x\0\r\n").is_none());
    }
}
