pub mod app_config_repo;
pub mod nedb_import;
pub mod proxy_repo;
pub mod server_repo;
pub mod version_repo;

use app_config_repo::AppConfigRepository;

use rusqlite::Connection;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub const MIGRATION_001: &str = include_str!("../../migrations/001_initial_schema.sql");
pub const MIGRATION_002: &str = include_str!("../../migrations/002_tls2raw_plugin.sql");
pub const MIGRATION_003: &str = include_str!("../../migrations/003_custom_frpc_path.sql");

/// Decode a JSON column without discarding the whole object when one field
/// has an unexpected shape (e.g. `null` or a value written by Electron 1.x).
/// Nulls fall back to field defaults; fields that still fail are dropped
/// individually and the remaining stored values are kept.
pub fn from_json_lenient<T: DeserializeOwned + Default>(raw: &str) -> T {
    let mut value: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("Invalid JSON column, using defaults: {}", e);
            return T::default();
        }
    };
    strip_nulls(&mut value);

    if let Ok(parsed) = serde_json::from_value::<T>(value.clone()) {
        return parsed;
    }

    let Value::Object(stored) = value else {
        return T::default();
    };
    let mut kept = Map::new();
    for (key, field) in stored {
        let mut trial = kept.clone();
        trial.insert(key.clone(), field);
        if serde_json::from_value::<T>(Value::Object(trial.clone())).is_ok() {
            kept = trial;
        } else {
            log::warn!("Ignoring incompatible JSON field: {}", key);
        }
    }
    serde_json::from_value(Value::Object(kept)).unwrap_or_default()
}

fn strip_nulls(value: &mut Value) {
    match value {
        Value::Object(map) => {
            map.retain(|_, v| !v.is_null());
            map.values_mut().for_each(strip_nulls);
        }
        Value::Array(items) => {
            items.retain(|v| !v.is_null());
            items.iter_mut().for_each(strip_nulls);
        }
        _ => {}
    }
}

#[derive(Clone)]
pub struct DbManager {
    conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

impl DbManager {
    pub fn init<P: AsRef<Path>>(storage_dir: P) -> anyhow::Result<Self> {
        let dir = storage_dir.as_ref();
        if !dir.exists() {
            fs::create_dir_all(dir)?;
        }
        let db_path = dir.join("frpc-desktop.sqlite3");
        let mut conn = Connection::open(&db_path)?;

        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA busy_timeout = 5000;",
        )?;

        // Run migrations
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS t_frpcd_schema_migrations (
                version INTEGER CONSTRAINT pk_t_frpcd_schema_migrations PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TEXT NOT NULL
             );",
        )?;

        let applied_versions: Vec<i64> = {
            let mut stmt = conn.prepare("SELECT version FROM t_frpcd_schema_migrations ORDER BY version")?;
            let rows = stmt.query_map([], |r| r.get(0))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        if !applied_versions.contains(&1) {
            conn.execute_batch(MIGRATION_001)?;
            conn.execute(
                "INSERT INTO t_frpcd_schema_migrations (version, name, applied_at) VALUES (1, '001_initial_schema', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                [],
            )?;
        }

        if !applied_versions.contains(&2) {
            conn.execute_batch(MIGRATION_002)?;
            conn.execute(
                "INSERT INTO t_frpcd_schema_migrations (version, name, applied_at) VALUES (2, '002_tls2raw_plugin', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                [],
            )?;
        }

        if !applied_versions.contains(&3) {
            conn.execute_batch(MIGRATION_003)?;
            conn.execute(
                "INSERT INTO t_frpcd_schema_migrations (version, name, applied_at) VALUES (3, '003_custom_frpc_path', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
                [],
            )?;
        }

        // Electron <= 1.2.6 stored data in NeDB; keep the files on failure so
        // the import can be retried on the next start.
        let nedb_imported = match nedb_import::import_if_needed(&mut conn, dir) {
            Ok(imported) => imported,
            Err(e) => {
                log::error!("NeDB import failed, original files kept: {}", e);
                false
            }
        };

        // The guide flag used to live in webview localStorage, which does not
        // survive the Electron -> Tauri upgrade; don't replay it for existing users.
        let existing_install = applied_versions.contains(&1) || nedb_imported;
        if existing_install && !AppConfigRepository::is_guide_completed(&conn).unwrap_or(false) {
            let _ = AppConfigRepository::save_guide_completed(&conn);
        }

        // Initialize default server config if absent
        let _ = server_repo::ServerRepository::get_server_config(&conn);

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
        })
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("Failed to lock db connection")
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::proxy_repo::ProxyRepository;
    use crate::db::server_repo::ServerRepository;
    use crate::db::version_repo::VersionRepository;
    use crate::downloader::VersionManager;
    use crate::models::TransportConfig;

    /// Build a database exactly as Electron v1.2.7 left it (only migration 001,
    /// recorded without the numeric prefix, rows written by its repositories)
    /// and make sure Tauri upgrades and reads it back without losing anything.
    #[test]
    fn opens_electron_v1_2_7_database_without_data_loss() {
        let dir = std::env::temp_dir().join(format!("frpc_legacy_db_{}", uuid::Uuid::new_v4()));
        let db_dir = dir.join("db");
        let version_dir = dir.join(format!("{:x}", md5::compute("frpc"))).join("v0.61.0");
        fs::create_dir_all(&db_dir).unwrap();
        fs::create_dir_all(&version_dir).unwrap();
        let legacy_bin_name = if cfg!(target_os = "windows") {
            format!("{:x}.exe", md5::compute("frpc"))
        } else {
            format!("{:x}", md5::compute("frpc"))
        };
        fs::write(version_dir.join(&legacy_bin_name), b"bin").unwrap();

        {
            let conn = Connection::open(db_dir.join("frpc-desktop.sqlite3")).unwrap();
            conn.execute_batch(MIGRATION_001).unwrap();
            conn.execute_batch(
                "INSERT INTO t_frpcd_schema_migrations VALUES
                   (1, 'initial_schema', '2026-01-01T00:00:00.000Z');",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO t_frpcd_servers (
                   id, frpc_version, multiuser, user, server_addr, server_port,
                   login_fail_exit, udp_packet_size, auth_json, log_json,
                   web_server_json, transport_json, metadatas_json
                 ) VALUES ('1', 160000001, 0, 'u', 'frps.example.com', 7001, 1, 1500,
                   '{\"method\":\"token\",\"token\":\"example-token\"}',
                   '{\"to\":\"\",\"level\":\"debug\",\"maxDays\":7,\"disablePrintColor\":false}',
                   '{\"addr\":\"127.0.0.1\",\"port\":57400,\"user\":\"\",\"password\":\"\",\"pprofEnable\":false}',
                   ?1, '{\"token\":\"\"}')",
                [r#"{"dialServerTimeout":10,"dialServerKeepalive":7200,"poolCount":0,
                    "tcpMux":true,"tcpMuxKeepaliveInterval":30,"protocol":"tcp",
                    "connectServerLocalIP":"10.0.0.2","proxyURL":"http://proxy.example.com:8080",
                    "tls":{"enable":true,"certFile":"","keyFile":"","trustedCaFile":"",
                           "serverName":null,"disableCustomTLSFirstByte":true},
                    "heartbeatInterval":null,"heartbeatTimeout":90}"#],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO t_frpcd_proxies (id, name, type, local_ip, local_port, remote_port,
                   transport_json)
                 VALUES ('p1', 'web', 'tcp', '127.0.0.1', '8080', '6000',
                   '{\"useEncryption\":true,\"useCompression\":false,\"proxyProtocolVersion\":null}')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO t_frpcd_versions (id, github_release_id, github_asset_id,
                   github_created_at, name, asset_name, browser_download_url, downloaded, local_path)
                 VALUES ('v1', 160000001, 1, '2026-01-01T00:00:00Z', 'v0.61.0',
                   'frp_0.61.0.tar.gz', 'https://example.com/frp.tar.gz', 1, ?1)",
                [version_dir.to_str().unwrap()],
            )
            .unwrap();
            conn.execute_batch(
                "INSERT INTO t_frpcd_app_config (id, namespace, config_key, value_type, config_value)
                 VALUES ('c1', 'desktop', 'launch_at_startup', 'boolean', 'true'),
                        ('c2', 'desktop', 'language', 'string', 'zh-CN'),
                        ('c3', 'migration', 'nedb_v2_imported', 'boolean', 'true');",
            )
            .unwrap();
        }

        let db = DbManager::init(&db_dir).unwrap();
        let conn = db.conn();

        let server = ServerRepository::get_server_config(&conn).unwrap();
        assert_eq!(server.server_addr, "frps.example.com");
        assert_eq!(server.server_port, 7001);
        assert_eq!(server.frpc_version, Some(160000001));
        assert_eq!(server.auth.token, "example-token");
        assert_eq!(server.log.level, "debug");
        assert_eq!(server.log.max_days, 7);
        assert!(server.web_server.enable);
        assert_eq!(server.transport.connect_server_local_ip, "10.0.0.2");
        assert_eq!(server.transport.proxy_url, "http://proxy.example.com:8080");
        assert!(server.transport.tls.enable);
        assert!(server.transport.tls.disable_custom_tls_first_byte);
        assert_eq!(server.transport.heartbeat_timeout, 90);
        assert!(server.system.launch_at_startup);
        assert_eq!(server.system.language, "zh-CN");
        assert_eq!(server.custom_frpc_path, "");

        let proxies = ProxyRepository::get_all_proxies(&conn).unwrap();
        assert_eq!(proxies.len(), 1);
        assert!(proxies[0].transport.use_encryption);

        let version = VersionRepository::find_by_github_release_id(&conn, 160000001)
            .unwrap()
            .expect("downloaded version must be kept");
        let bin = VersionManager::resolve_frpc_binary(version.local_path.unwrap());
        assert_eq!(bin, Some(version_dir.join(&legacy_bin_name)));

        // Saving through Tauri must round-trip the Electron field names.
        ServerRepository::save_server_config(&conn, &server).unwrap();
        let transport_json: String = conn
            .query_row("SELECT transport_json FROM t_frpcd_servers", [], |r| r.get(0))
            .unwrap();
        assert!(transport_json.contains("\"proxyURL\""));
        assert!(transport_json.contains("\"connectServerLocalIP\""));
        assert!(transport_json.contains("\"disableCustomTLSFirstByte\""));

        let applied: i64 = conn
            .query_row("SELECT COUNT(*) FROM t_frpcd_schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(applied, 3);

        // Upgraded users already saw the guide in Electron (localStorage is gone).
        assert!(AppConfigRepository::is_guide_completed(&conn).unwrap());

        drop(conn);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn imports_electron_nedb_files_once() {
        let dir = std::env::temp_dir().join(format!("frpc_nedb_{}", uuid::Uuid::new_v4()));
        let db_dir = dir.join("db");
        fs::create_dir_all(&db_dir).unwrap();
        fs::write(
            db_dir.join("server-v2.db"),
            concat!(
                r#"{"_id":"1","serverAddr":"old.example.com","serverPort":7000,"auth":{"method":"token","token":"example-token"},"transport":{"proxyURL":"socks5://127.0.0.1:1080","tls":{"enable":false}},"system":{"launchAtStartup":true,"language":"zh-CN"}}"#, "\n",
                r#"{"_id":"1","serverAddr":"frps.example.com","serverPort":7001,"auth":{"method":"token","token":"example-token"},"transport":{"proxyURL":"socks5://127.0.0.1:1080","tls":{"enable":false}},"system":{"launchAtStartup":true,"language":"zh-CN"}}"#, "\n",
                r#"{"$$indexCreated":{"fieldName":"serverAddr"}}"#, "\n",
            ),
        )
        .unwrap();
        fs::write(
            db_dir.join("proxy-v2.db"),
            concat!(
                r#"{"_id":"p1","name":"web","type":"http","localIP":"127.0.0.1","localPort":8080,"remotePort":"80","customDomains":["a.example.com"],"status":0}"#, "\n",
                r#"{"_id":"p2","name":"gone","type":"tcp"}"#, "\n",
                r#"{"_id":"p2","$$deleted":true}"#, "\n",
                "not json\n",
            ),
        )
        .unwrap();

        {
            let db = DbManager::init(&db_dir).unwrap();
            let conn = db.conn();
            let server = ServerRepository::get_server_config(&conn).unwrap();
            assert_eq!(server.server_addr, "frps.example.com");
            assert_eq!(server.server_port, 7001);
            assert_eq!(server.auth.token, "example-token");
            assert_eq!(server.transport.proxy_url, "socks5://127.0.0.1:1080");
            assert!(!server.transport.tls.enable);
            // Not present in NeDB: keep the new-install default.
            assert!(server.transport.tls.disable_custom_tls_first_byte);
            assert_eq!(server.web_server.port, 57400);
            assert!(server.system.launch_at_startup);
            assert_eq!(server.system.language, "zh-CN");

            let proxies = ProxyRepository::get_all_proxies(&conn).unwrap();
            assert_eq!(proxies.len(), 1);
            assert_eq!(proxies[0].id, "p1");
            assert_eq!(proxies[0].status, 0);
            assert_eq!(proxies[0].custom_domains, vec!["a.example.com"]);
        }
        assert!(AppConfigRepository::is_guide_completed(&DbManager::init(&db_dir).unwrap().conn()).unwrap());
        assert!(!db_dir.join("server-v2.db").exists());
        assert!(!db_dir.join("proxy-v2.db").exists());

        // A stray NeDB file after a successful import must not be re-imported.
        fs::write(
            db_dir.join("proxy-v2.db"),
            r#"{"_id":"p3","name":"late","type":"tcp"}"#,
        )
        .unwrap();
        let db = DbManager::init(&db_dir).unwrap();
        assert_eq!(ProxyRepository::get_all_proxies(&db.conn()).unwrap().len(), 1);

        drop(db);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn guide_state_for_new_install_survives_config_reset() {
        let dir = std::env::temp_dir().join(format!("frpc_guide_{}", uuid::Uuid::new_v4()));
        let db = DbManager::init(&dir).unwrap();
        let conn = db.conn();
        assert!(!AppConfigRepository::is_guide_completed(&conn).unwrap());

        AppConfigRepository::save_guide_completed(&conn).unwrap();
        AppConfigRepository::save_guide_completed(&conn).unwrap();
        ServerRepository::reset_all_config(&conn).unwrap();
        assert!(AppConfigRepository::is_guide_completed(&conn).unwrap());

        drop(conn);
        drop(db);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn lenient_json_keeps_valid_fields_when_one_is_incompatible() {
        let transport: TransportConfig =
            from_json_lenient(r#"{"poolCount":"many","protocol":"kcp","tls":{"enable":true}}"#);
        assert_eq!(transport.protocol, "kcp");
        assert!(transport.tls.enable);
        assert_eq!(transport.pool_count, 0);
    }
}
