use crate::config_gen::parse_toml_config;
use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::db::tunnel_repo::{TunnelRepository, MAX_TUNNEL_NAME_LEN, PROVIDER_FRPC};
use crate::models::Tunnel;
use rusqlite::{params, Connection};
use std::path::Path;

fn validate_name(name: &str) -> anyhow::Result<&str> {
    let name = name.trim();
    anyhow::ensure!(
        !name.is_empty() && name.chars().count() <= MAX_TUNNEL_NAME_LEN,
        "Invalid tunnel name"
    );
    Ok(name)
}

/// Create a new frpc instance and import its configuration in one transaction.
/// Canceling file selection never calls this function; any failure leaves no instance.
/// `base_dir` is the imported file's directory, used to resolve relative paths.
pub fn import_toml_config(
    conn: &mut Connection,
    name: &str,
    content: &str,
    base_dir: Option<&Path>,
) -> anyhow::Result<Tunnel> {
    let name = validate_name(name)?;
    let tx = conn.transaction()?;
    let tunnel = TunnelRepository::create_in_transaction(&tx, name, PROVIDER_FRPC)?;
    let current = ServerRepository::get_server_config(&tx, &tunnel.id)?;
    let (mut server, proxies) = parse_toml_config(content, &current, base_dir)?;
    if server.web_server.enable {
        let port_in_use: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM t_frpcd_servers
             WHERE id <> ?1 AND json_extract(web_server_json, '$.port') = ?2)",
            params![tunnel.id, server.web_server.port],
            |row| row.get(0),
        )?;
        if port_in_use {
            server.web_server.port = current.web_server.port;
        }
    }
    ServerRepository::save_frpc_settings(&tx, &server)?;
    for mut proxy in proxies {
        proxy.id.clear();
        proxy.server_id = tunnel.id.clone();
        ProxyRepository::create_proxy(&tx, proxy)?;
    }
    tx.commit()?;
    Ok(tunnel)
}

/// Create a new frpc instance from the JSON payload of a shared frp:// link.
/// The link is decoded by the renderer; this function validates the fields it
/// uses and never echoes payload values in errors, since they may contain tokens.
pub fn import_link_config(
    conn: &mut Connection,
    name: &str,
    payload: &str,
) -> anyhow::Result<Tunnel> {
    let name = validate_name(name)?;
    let value: serde_json::Value =
        serde_json::from_str(payload).map_err(|_| anyhow::anyhow!("Invalid link content"))?;
    anyhow::ensure!(value.is_object(), "Invalid link content");

    let tx = conn.transaction()?;
    let tunnel = TunnelRepository::create_in_transaction(&tx, name, PROVIDER_FRPC)?;
    let mut server = ServerRepository::get_server_config(&tx, &tunnel.id)?;

    if let Some(v) = value.get("serverAddr") {
        server.server_addr = v
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid link content"))?
            .to_string();
    }
    if let Some(v) = value.get("serverPort") {
        let port = v
            .as_i64()
            .ok_or_else(|| anyhow::anyhow!("Invalid link content"))?;
        anyhow::ensure!((1..=65535).contains(&port), "Invalid link content");
        server.server_port = port;
    }
    if let Some(v) = value.get("user") {
        server.user = v
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid link content"))?
            .to_string();
    }
    if let Some(v) = value.get("multiuser") {
        server.multiuser = v
            .as_bool()
            .ok_or_else(|| anyhow::anyhow!("Invalid link content"))?;
    }
    if let Some(v) = value.get("auth") {
        server.auth = serde_json::from_value(v.clone())
            .map_err(|_| anyhow::anyhow!("Invalid link content"))?;
    }
    if let Some(v) = value.get("transport") {
        server.transport = serde_json::from_value(v.clone())
            .map_err(|_| anyhow::anyhow!("Invalid link content"))?;
        // frpc rejects heartbeatTimeout < heartbeatInterval, and a zero value
        // falls back to frpc's defaults (30s/90s). Raise the timeout only when
        // the imported pair would otherwise be rejected.
        let interval = match server.transport.heartbeat_interval {
            value if value > 0 => value,
            _ => 30,
        };
        let timeout = match server.transport.heartbeat_timeout {
            value if value > 0 => value,
            _ => 90,
        };
        if timeout < interval {
            server.transport.heartbeat_timeout = interval;
        }
    }
    if let Some(v) = value.get("metadatas") {
        server.metadatas = serde_json::from_value(v.clone())
            .map_err(|_| anyhow::anyhow!("Invalid link content"))?;
    }

    ServerRepository::save_frpc_settings(&tx, &server)?;
    tx.commit()?;
    Ok(tunnel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::app_config_repo::AppConfigRepository;
    use crate::db::DbManager;
    use crate::models::FrpcProxy;

    #[test]
    fn import_creates_an_isolated_instance_without_changing_existing_data() {
        let dir = std::env::temp_dir().join(format!("frpc_import_{}", uuid::Uuid::new_v4()));
        let db = DbManager::init(&dir).unwrap();
        let mut conn = db.conn();
        let mut existing_server = ServerRepository::get_server_config(&conn, "1").unwrap();
        existing_server.server_addr = "existing.example.test".into();
        existing_server.custom_frpc_path = "/example/frpc".into();
        ServerRepository::save_frpc_settings(&conn, &existing_server).unwrap();
        AppConfigRepository::save_language(&conn, "zh-CN").unwrap();
        let before =
            serde_json::to_value(ServerRepository::get_server_config(&conn, "1").unwrap()).unwrap();
        let existing = ProxyRepository::create_proxy(
            &conn,
            FrpcProxy {
                server_id: "1".into(),
                name: "existing".into(),
                proxy_type: "tcp".into(),
                ..Default::default()
            },
        )
        .unwrap();

        let imported = import_toml_config(
            &mut conn,
            " Imported ",
            r#"
serverAddr = "frps.example.test"
serverPort = 7001
[webServer]
port = 57400
[[proxies]]
name = "web"
type = "tcp"
localPort = 8080
remotePort = 6000
[[visitors]]
name = "visitor"
type = "stcp"
serverName = "private"
bindAddr = "127.0.0.1"
bindPort = 9000
"#,
            None,
        )
        .unwrap();
        assert_ne!(imported.id, "1");
        assert_eq!(imported.name, "Imported");
        assert_eq!(imported.provider, "frpc");
        assert!(!imported.auto_start);
        let saved = ServerRepository::get_server_config(&conn, &imported.id).unwrap();
        assert_eq!(saved.server_addr, "frps.example.test");
        assert_eq!(saved.server_port, 7001);
        assert_eq!(saved.frpc_version, None);
        assert!(saved.custom_frpc_path.is_empty());
        assert_eq!(saved.web_server.port, 57401);
        assert_eq!(saved.system.language, "zh-CN");
        let proxies = ProxyRepository::get_proxies_by_server(&conn, &imported.id).unwrap();
        assert_eq!(proxies.len(), 2);
        assert!(proxies
            .iter()
            .all(|p| p.server_id == imported.id && !p.id.is_empty()));
        assert!(proxies
            .iter()
            .any(|p| p.name == "visitor" && p.visitors_model == "visitors"));
        assert_eq!(
            serde_json::to_value(ServerRepository::get_server_config(&conn, "1").unwrap()).unwrap(),
            before
        );
        let kept = ProxyRepository::get_proxies_by_server(&conn, "1").unwrap();
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].id, existing.id);

        // Repeated imports also get separate instances and monitoring ports.
        let second = import_toml_config(
            &mut conn,
            "Second",
            "serverAddr = 'second.example.test'",
            None,
        )
        .unwrap();
        assert_ne!(second.id, imported.id);
        assert_eq!(
            ServerRepository::get_server_config(&conn, &second.id)
                .unwrap()
                .web_server
                .port,
            57402
        );
        drop(conn);
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn import_resolves_relative_certificate_paths_from_the_toml_location() {
        let dir = std::env::temp_dir().join(format!("frpc_import_rel_{}", uuid::Uuid::new_v4()));
        let db = DbManager::init(&dir).unwrap();
        let mut conn = db.conn();
        let source = Path::new(if cfg!(windows) {
            r"C:\configs\site"
        } else {
            "/configs/site"
        });
        let imported = import_toml_config(
            &mut conn,
            "Relative",
            r#"
serverAddr = "example.test"
[transport.tls]
certFile = "certs/client.pem"
trustedCaFile = "ca.pem"
[[proxies]]
name = "web"
type = "https"
customDomains = ["example.test"]
[proxies.plugin]
type = "https2http"
localAddr = "127.0.0.1:8080"
crtPath = "certs/plugin.pem"
keyPath = "certs/plugin.key"
"#,
            Some(source),
        )
        .unwrap();
        let saved = ServerRepository::get_server_config(&conn, &imported.id).unwrap();
        assert_eq!(
            Path::new(&saved.transport.tls.cert_file),
            source.join("certs/client.pem")
        );
        assert_eq!(
            Path::new(&saved.transport.tls.trusted_ca_file),
            source.join("ca.pem")
        );
        let proxies = ProxyRepository::get_proxies_by_server(&conn, &imported.id).unwrap();
        assert_eq!(
            Path::new(&proxies[0].https2http_ca_file),
            source.join("certs/plugin.pem")
        );
        assert_eq!(
            Path::new(&proxies[0].https2http_key_file),
            source.join("certs/plugin.key")
        );
        drop(conn);
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn import_failure_rolls_back_the_instance_server_and_all_proxies() {
        let dir = std::env::temp_dir().join(format!("frpc_import_{}", uuid::Uuid::new_v4()));
        let db = DbManager::init(&dir).unwrap();
        let mut conn = db.conn();
        let before =
            serde_json::to_value(TunnelRepository::list_summaries(&conn).unwrap()).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER fail_import BEFORE INSERT ON t_frpcd_proxies
            WHEN NEW.name = 'fail' BEGIN SELECT RAISE(ABORT, 'test import failure'); END;",
        )
        .unwrap();
        assert!(import_toml_config(
            &mut conn,
            "Failed",
            r#"
serverAddr = "frps.example.test"
[[proxies]]
name = "first"
type = "tcp"
localPort = 8080
remotePort = 6000
[[proxies]]
name = "fail"
type = "tcp"
localPort = 8081
remotePort = 6001
"#,
            None
        )
        .is_err());
        assert!(import_toml_config(&mut conn, "Malformed", "serverAddr = [", None).is_err());
        assert!(import_toml_config(
            &mut conn,
            "Unsupported",
            "serverAddr = 'example.test'\nincludes = ['other.toml']",
            None
        )
        .is_err());
        assert!(import_toml_config(&mut conn, " ", "serverAddr = 'example.test'", None).is_err());
        assert!(import_toml_config(
            &mut conn,
            &"a".repeat(65),
            "serverAddr = 'example.test'",
            None
        )
        .is_err());
        assert_eq!(
            serde_json::to_value(TunnelRepository::list_summaries(&conn).unwrap()).unwrap(),
            before
        );
        assert!(ProxyRepository::get_all_proxies(&conn).unwrap().is_empty());
        let servers: i64 = conn
            .query_row("SELECT COUNT(*) FROM t_frpcd_servers", [], |row| row.get(0))
            .unwrap();
        assert_eq!(servers, 1);
        drop(conn);
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn link_import_creates_an_instance_with_shared_server_settings() {
        let dir = std::env::temp_dir().join(format!("frpc_link_{}", uuid::Uuid::new_v4()));
        let db = DbManager::init(&dir).unwrap();
        let mut conn = db.conn();
        let before =
            serde_json::to_value(ServerRepository::get_server_config(&conn, "1").unwrap()).unwrap();

        let tunnel = import_link_config(
            &mut conn,
            " Shared ",
            r#"{
                "serverAddr": "link.example.test",
                "serverPort": 7002,
                "user": "link-user",
                "multiuser": true,
                "auth": { "method": "token", "token": "secret" },
                "transport": { "tcpMux": false, "heartbeatInterval": 12 },
                "metadatas": { "token": "meta" },
                "unknown": "ignored"
            }"#,
        )
        .unwrap();
        assert_eq!(tunnel.name, "Shared");
        let server = ServerRepository::get_server_config(&conn, &tunnel.id).unwrap();
        assert_eq!(server.server_addr, "link.example.test");
        assert_eq!(server.server_port, 7002);
        assert_eq!(server.user, "link-user");
        assert!(server.multiuser);
        assert_eq!(server.auth.token, "secret");
        assert!(!server.transport.tcp_mux);
        assert_eq!(server.transport.heartbeat_interval, 12);
        assert_eq!(server.metadatas["token"], "meta");
        assert_eq!(server.web_server.port, 57401);
        assert_eq!(server.frpc_version, None);
        assert_eq!(
            serde_json::to_value(ServerRepository::get_server_config(&conn, "1").unwrap()).unwrap(),
            before
        );

        for payload in [
            "not json",
            r#"{"serverPort": 0}"#,
            r#"{"serverPort": "7000"}"#,
            r#"{"auth": "secret"}"#,
            r#"{"metadatas": []}"#,
            "[]",
        ] {
            assert!(import_link_config(&mut conn, "Broken", payload).is_err());
        }
        assert!(import_link_config(&mut conn, " ", "{}").is_err());
        assert!(import_link_config(&mut conn, &"a".repeat(65), "{}").is_err());
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM t_frpcd_tunnels", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        drop(conn);
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn link_import_raises_heartbeat_timeout_below_interval() {
        let dir = std::env::temp_dir().join(format!("frpc_link_hb_{}", uuid::Uuid::new_v4()));
        let db = DbManager::init(&dir).unwrap();
        let mut conn = db.conn();

        for (name, payload, expected) in [
            (
                "Short timeout",
                r#"{"transport": {"heartbeatInterval": 120, "heartbeatTimeout": 10}}"#,
                120,
            ),
            (
                "Missing timeout",
                r#"{"transport": {"heartbeatInterval": 120}}"#,
                120,
            ),
            (
                "Default pair",
                r#"{"transport": {"heartbeatInterval": 30, "heartbeatTimeout": 90}}"#,
                90,
            ),
        ] {
            let tunnel = import_link_config(&mut conn, name, payload).unwrap();
            let server = ServerRepository::get_server_config(&conn, &tunnel.id).unwrap();
            assert_eq!(server.transport.heartbeat_timeout, expected, "{name}");
        }

        drop(conn);
        drop(db);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
