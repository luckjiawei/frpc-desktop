use crate::config_gen::parse_toml_config;
use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::db::tunnel_repo::{TunnelRepository, MAX_TUNNEL_NAME_LEN, PROVIDER_FRPC};
use crate::models::Tunnel;
use rusqlite::{params, Connection};

/// Create a new frpc instance and import its configuration in one transaction.
/// Canceling file selection never calls this function; any failure leaves no instance.
pub fn import_toml_config(
    conn: &mut Connection,
    name: &str,
    content: &str,
) -> anyhow::Result<Tunnel> {
    let name = name.trim();
    anyhow::ensure!(
        !name.is_empty() && name.chars().count() <= MAX_TUNNEL_NAME_LEN,
        "Invalid tunnel name"
    );
    let tx = conn.transaction()?;
    let tunnel = TunnelRepository::create_in_transaction(&tx, name, PROVIDER_FRPC)?;
    let current = ServerRepository::get_server_config(&tx, &tunnel.id)?;
    let (mut server, proxies) = parse_toml_config(content, &current)?;
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
        let second =
            import_toml_config(&mut conn, "Second", "serverAddr = 'second.example.test'").unwrap();
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
"#
        )
        .is_err());
        assert!(import_toml_config(&mut conn, "Malformed", "serverAddr = [").is_err());
        assert!(import_toml_config(
            &mut conn,
            "Unsupported",
            "serverAddr = 'example.test'\nincludes = ['other.toml']"
        )
        .is_err());
        assert!(import_toml_config(&mut conn, " ", "serverAddr = 'example.test'").is_err());
        assert!(
            import_toml_config(&mut conn, &"a".repeat(65), "serverAddr = 'example.test'").is_err()
        );
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
}
