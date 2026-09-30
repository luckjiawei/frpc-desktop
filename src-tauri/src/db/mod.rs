pub mod app_config_repo;
pub mod proxy_repo;
pub mod server_repo;
pub mod version_repo;

use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub const MIGRATION_001: &str = include_str!("../../migrations/001_initial_schema.sql");
pub const MIGRATION_002: &str = include_str!("../../migrations/002_tls2raw_plugin.sql");
pub const MIGRATION_003: &str = include_str!("../../migrations/003_custom_frpc_path.sql");

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
        let conn = Connection::open(&db_path)?;

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
