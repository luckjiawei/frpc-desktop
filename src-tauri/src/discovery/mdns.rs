use super::{
    interfaces::Scope,
    merge::{Observation, Service},
    sockets, SourceReport,
};
use std::{
    collections::{HashMap, HashSet},
    net::IpAddr,
    time::Duration,
};
use tokio::{
    sync::{mpsc, watch},
    time::Instant,
};

const BASE_TYPES: [&str; 7] = [
    "_http._tcp.local.",
    "_https._tcp.local.",
    "_ssh._tcp.local.",
    "_smb._tcp.local.",
    "_ipp._tcp.local.",
    "_ipps._tcp.local.",
    "_services._dns-sd._udp.local.",
];
const MAX_RECORDS: usize = 2048;
const MAX_QUERIES: usize = 256;
#[derive(Clone, Debug)]
enum Data {
    Address(IpAddr),
    Ptr(String),
    Srv { port: u16, target: String },
}
#[derive(Clone, Debug)]
struct Record {
    name: String,
    ttl: u32,
    data: Data,
}

fn u16_at(packet: &[u8], at: usize) -> Result<u16, ()> {
    Ok(u16::from_be_bytes(
        packet
            .get(at..at + 2)
            .ok_or(())?
            .try_into()
            .map_err(|_| ())?,
    ))
}
fn name(packet: &[u8], cursor: &mut usize) -> Result<String, ()> {
    let mut at = *cursor;
    let mut result = String::new();
    let mut jumped = false;
    let mut visited = HashSet::new();
    let mut wire_len = 0;
    for _ in 0..128 {
        if !visited.insert(at) {
            return Err(());
        }
        let len = *packet.get(at).ok_or(())?;
        if len & 0xc0 == 0xc0 {
            let pointer =
                (usize::from(len & 0x3f) << 8) | usize::from(*packet.get(at + 1).ok_or(())?);
            if !jumped {
                *cursor = at + 2;
                jumped = true;
            }
            at = pointer;
        } else if len == 0 {
            if !jumped {
                *cursor = at + 1;
            }
            return Ok(result);
        } else {
            if len & 0xc0 != 0 {
                return Err(());
            }
            let end = at + 1 + usize::from(len);
            let label = packet.get(at + 1..end).ok_or(())?;
            wire_len += usize::from(len) + 1;
            if wire_len > 254 {
                return Err(());
            }
            result.push_str(&String::from_utf8_lossy(label).to_ascii_lowercase());
            result.push('.');
            at = end;
        }
    }
    Err(())
}
fn parse(packet: &[u8]) -> Result<Vec<Record>, ()> {
    if packet.len() < 12 || packet.len() > 9000 || u16_at(packet, 2)? & 0xf80f != 0x8000 {
        return Err(());
    }
    let questions = usize::from(u16_at(packet, 4)?);
    let count = usize::from(u16_at(packet, 6)?)
        + usize::from(u16_at(packet, 8)?)
        + usize::from(u16_at(packet, 10)?);
    if questions > 64 || count > 128 {
        return Err(());
    }
    let mut cursor = 12;
    for _ in 0..questions {
        name(packet, &mut cursor)?;
        cursor = cursor.checked_add(4).ok_or(())?;
        if cursor > packet.len() {
            return Err(());
        }
    }
    let mut records = Vec::new();
    for _ in 0..count {
        let owner = name(packet, &mut cursor)?;
        let kind = u16_at(packet, cursor)?;
        let class = u16_at(packet, cursor + 2)? & 0x7fff;
        let ttl = u32::from_be_bytes(
            packet
                .get(cursor + 4..cursor + 8)
                .ok_or(())?
                .try_into()
                .map_err(|_| ())?,
        );
        let len = usize::from(u16_at(packet, cursor + 8)?);
        cursor += 10;
        let end = cursor
            .checked_add(len)
            .filter(|end| *end <= packet.len())
            .ok_or(())?;
        let data = if class != 1 {
            None
        } else {
            match kind {
                1 if len == 4 => Some(Data::Address(IpAddr::from(
                    <[u8; 4]>::try_from(&packet[cursor..end]).map_err(|_| ())?,
                ))),
                28 if len == 16 => Some(Data::Address(IpAddr::from(
                    <[u8; 16]>::try_from(&packet[cursor..end]).map_err(|_| ())?,
                ))),
                12 => {
                    let mut pos = cursor;
                    let target = name(packet, &mut pos)?;
                    if pos != end {
                        return Err(());
                    }
                    Some(Data::Ptr(target))
                }
                33 if len >= 7 => {
                    let port = u16_at(packet, cursor + 4)?;
                    let mut pos = cursor + 6;
                    let target = name(packet, &mut pos)?;
                    if pos != end || port == 0 {
                        return Err(());
                    }
                    Some(Data::Srv { port, target })
                }
                _ => None,
            }
        };
        if let Some(data) = data {
            if owner.ends_with(".local.") {
                records.push(Record {
                    name: owner,
                    ttl: ttl.min(86400),
                    data,
                });
            }
        }
        cursor = end;
    }
    Ok(records)
}
fn query(name: &str, kind: u16) -> Option<Vec<u8>> {
    if name.len() > 255 || !name.ends_with(".local.") {
        return None;
    }
    let mut packet = vec![0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
    for label in name.trim_end_matches('.').split('.') {
        if label.is_empty() || label.len() > 63 {
            return None;
        }
        packet.push(label.len() as u8);
        packet.extend_from_slice(label.as_bytes());
    }
    packet.push(0);
    packet.extend_from_slice(&kind.to_be_bytes());
    packet.extend_from_slice(&1u16.to_be_bytes());
    Some(packet)
}
fn service_type(value: &str) -> bool {
    let labels: Vec<_> = value.trim_end_matches('.').split('.').collect();
    labels.len() == 3
        && labels[0].starts_with('_')
        && labels[0].len() <= 63
        && labels[0]
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        && matches!(labels[1], "_tcp" | "_udp")
        && labels[2] == "local"
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
    SourceReport::combine("mdns", a, b)
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
    let (socket, destination) = sockets::udp(scope, ipv6, true).map_err(|_| "socketUnavailable")?;
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut queries = HashSet::new();
    let mut types: HashSet<String> = BASE_TYPES.iter().map(|s| s.to_string()).collect();
    let mut cache: HashMap<String, (Record, Instant)> = HashMap::new();
    for kind in BASE_TYPES {
        let packet = query(kind, 12).unwrap();
        let send = socket.send_to(&packet, destination);
        tokio::select! { _=cancel.changed()=>return Err("cancelled"), result=send=>{result.map_err(|_|"sendFailed")?;} }
        queries.insert((kind.to_string(), 12u16));
    }
    let mut packet = [0u8; 9001];
    let mut packets = 0;
    let mut limited = false;
    loop {
        let received = tokio::select! { _=cancel.changed()=>return Err("cancelled"), result=tokio::time::timeout_at(deadline,socket.recv_from(&mut packet))=>match result {Ok(Ok(value))=>value,Ok(Err(_))=>return Err("receiveFailed"),Err(_)=>break} };
        let (len, sender) = received;
        packets += 1;
        if packets > 2048 {
            limited = true;
            break;
        }
        if sender.port() != 5353 || !scope.allows(sender.ip()) {
            continue;
        }
        let Ok(records) = parse(&packet[..len]) else {
            continue;
        };
        let now = Instant::now();
        cache.retain(|_, (_, expiry)| *expiry > now);
        let mut requests = Vec::new();
        for record in records {
            match &record.data {
                Data::Ptr(target) if record.name == "_services._dns-sd._udp.local." => {
                    if service_type(target)
                        && types.len() < BASE_TYPES.len() + 32
                        && types.insert(target.clone())
                    {
                        requests.push((target.clone(), 12));
                    }
                }
                Data::Ptr(target)
                    if types.contains(&record.name) && target.ends_with(&record.name) =>
                {
                    requests.push((target.clone(), 33))
                }
                Data::Srv { target, .. } if target.ends_with(".local.") => {
                    requests.push((target.clone(), 1));
                    requests.push((target.clone(), 28));
                }
                _ => {}
            }
            let key = format!("{}:{:?}", record.name, record.data);
            if cache.len() >= MAX_RECORDS && !cache.contains_key(&key) {
                limited = true;
                continue;
            }
            let expires = now + Duration::from_secs(u64::from(record.ttl));
            cache.insert(key, (record, expires));
        }
        for (owner, kind) in requests {
            if queries.len() >= MAX_QUERIES {
                limited = true;
                break;
            }
            if queries.insert((owner.clone(), kind)) {
                if let Some(packet) = query(&owner, kind) {
                    tokio::select! {_ = cancel.changed()=>return Err("cancelled"),result=socket.send_to(&packet,destination)=>{result.map_err(|_|"sendFailed")?;}}
                }
            }
        }
        for (record, expires) in cache.values() {
            match &record.data {
                Data::Address(address) => {
                    let ttl = if record.ttl == 0 {
                        0
                    } else {
                        expires.saturating_duration_since(now).as_secs().max(1) as u32
                    };
                    if tx
                        .try_send(Observation {
                            address: *address,
                            name: record.name.clone(),
                            source: "mdns",
                            ttl: Some(ttl),
                            service: None,
                            os_hint: None,
                        })
                        .is_err()
                    {
                        limited = true;
                    }
                }
                Data::Srv { port, target } => {
                    let Some(kind) = types.iter().find(|kind| {
                        service_type(kind) && record.name.ends_with(&format!(".{kind}"))
                    }) else {
                        continue;
                    };
                    for (address_record, address_expiry) in
                        cache.values().filter(|(r, _)| r.name == *target)
                    {
                        let Data::Address(address) = address_record.data else {
                            continue;
                        };
                        let ttl = if record.ttl == 0 || address_record.ttl == 0 {
                            0
                        } else {
                            (*expires)
                                .min(*address_expiry)
                                .saturating_duration_since(now)
                                .as_secs()
                                .max(1) as u32
                        };
                        let item = Observation {
                            address,
                            name: target.clone(),
                            source: "mdns",
                            ttl: Some(ttl),
                            service: Some(Service {
                                name: record.name.clone(),
                                port: *port,
                                transport: if kind.contains("._tcp.") {
                                    "tcp"
                                } else {
                                    "udp"
                                },
                                hint: kind
                                    .split('.')
                                    .next()
                                    .map(|s| s.trim_start_matches('_').to_string()),
                            }),
                            os_hint: None,
                        };
                        if tx.try_send(item).is_err() {
                            limited = true;
                        }
                    }
                }
                _ => {}
            }
        }
    }
    Ok(limited)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn compression_cycles_and_overlong_names_are_rejected() {
        assert!(name(&[0xc0, 0], &mut 0).is_err());
        assert!(name(&[0xc0, 2, 0xc0, 0], &mut 0).is_err());
        assert!(name(&[63; 300], &mut 0).is_err());
        assert!(name(&[0xff, 0xff], &mut 0).is_err());
    }
    #[test]
    fn query_and_srv_records_parse_with_compressed_targets() {
        let mut packet = query("host.local.", 1).unwrap();
        packet[2] = 0x84;
        packet[7] = 1;
        packet.extend_from_slice(&[0xc0, 12, 0, 1, 0, 1, 0, 0, 0, 120, 0, 4, 192, 168, 4, 3]);
        let records = parse(&packet).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].name, "host.local.");
        assert!(matches!(records[0].data, Data::Address(_)));
        packet.pop();
        assert!(parse(&packet).is_err());
    }
    #[test]
    fn service_type_queries_are_local_and_bounded() {
        assert!(service_type("_printer._udp.local."));
        assert!(!service_type("_http._tcp.example.com."));
        assert!(!service_type("instance._http._tcp.local."));
        assert!(query("external.example.", 1).is_none());
    }
}
