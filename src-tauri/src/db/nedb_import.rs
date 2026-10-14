//! One-time import of Electron <= 1.2.6 NeDB files (`server-v2.db`,
//! `proxy-v2.db`, `version-v2.db`) into SQLite. Users that already ran
//! Electron 1.2.7 have the `migration/nedb_v2_imported` marker and are skipped.

use crate::db::from_json_lenient;
use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::db::version_repo::VersionRepository;
use crate::models::{FrpcProxy, FrpcVersion, OpenSourceFrpcDesktopServer};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

const NEDB_FILES: [&str; 3] = ["server-v2.db", "proxy-v2.db", "version-v2.db"];

/// Returns `true` when NeDB data was imported in this call.
pub fn import_if_needed(conn: &mut Connection, db_dir: &Path) -> anyhow::Result<bool> {
    if has_marker(conn)? {
        return Ok(false);
    }
    let existing: Vec<PathBuf> = NEDB_FILES
        .iter()
        .map(|name| db_dir.join(name))
        .filter(|path| path.is_file())
        .collect();
    if existing.is_empty() {
        return Ok(false);
    }

    let servers = load_documents(&db_dir.join(NEDB_FILES[0]))?;
    let proxies = load_documents(&db_dir.join(NEDB_FILES[1]))?;
    let versions = load_documents(&db_dir.join(NEDB_FILES[2]))?;
    if servers.len() > 1 {
        anyhow::bail!("NeDB import failed: multiple server configurations were found");
    }

    let tx = conn.transaction()?;
    if let Some(doc) = servers.into_iter().next() {
        ServerRepository::save_server_config(&tx, &normalize_server(doc))?;
    }
    for doc in proxies {
        ProxyRepository::create_proxy(&tx, normalize_proxy(doc))?;
    }
    for doc in versions {
        let version: FrpcVersion = from_json_lenient(&doc.to_string());
        if version.github_release_id == 0 {
            log::warn!("Skipping NeDB version record without githubReleaseId");
            continue;
        }
        VersionRepository::save_version(&tx, version)?;
    }
    tx.execute(
        "INSERT INTO t_frpcd_app_config (id, namespace, config_key, value_type, config_value)
         VALUES (?1, 'migration', 'nedb_v2_imported', 'boolean', 'true')",
        params![uuid::Uuid::new_v4().to_string()],
    )?;
    tx.commit()?;

    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S");
    for path in existing {
        let backup = PathBuf::from(format!("{}.migrated-{}.bak", path.display(), timestamp));
        if let Err(e) = fs::rename(&path, &backup) {
            log::warn!("Could not archive migrated NeDB file {:?}: {}", path.file_name(), e);
        }
    }
    log::info!("NeDB import completed");
    Ok(true)
}

fn has_marker(conn: &Connection) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT 1 FROM t_frpcd_app_config
         WHERE scope_type = 'global' AND scope_id IS NULL AND namespace = 'migration'
           AND config_key = 'nedb_v2_imported' AND config_value = 'true'
           AND deleted_at IS NULL",
        [],
        |_| Ok(()),
    )
    .optional()
    .map(|found| found.is_some())
}

/// NeDB is an append-only file of JSON lines: the last line for an `_id` wins
/// and `$$deleted` removes the document.
fn load_documents(path: &Path) -> anyhow::Result<Vec<Value>> {
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    let mut order: Vec<String> = Vec::new();
    let mut docs: Map<String, Value> = Map::new();
    for line in content.lines().filter(|l| !l.trim().is_empty()) {
        let Ok(doc) = serde_json::from_str::<Value>(line) else {
            log::warn!("Skipping corrupt line in {:?}", path.file_name());
            continue;
        };
        if doc.get("$$indexCreated").is_some() || doc.get("$$indexRemoved").is_some() {
            continue;
        }
        let Some(id) = doc.get("_id").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        if doc.get("$$deleted").and_then(Value::as_bool) == Some(true) {
            docs.remove(&id);
            continue;
        }
        if !docs.contains_key(&id) {
            order.push(id.clone());
        }
        docs.insert(id, doc);
    }
    Ok(order.into_iter().filter_map(|id| docs.remove(&id)).collect())
}

fn normalize_server(doc: Value) -> OpenSourceFrpcDesktopServer {
    // Missing values fall back to the same defaults a new install gets.
    let mut merged = serde_json::to_value(ServerRepository::create_default_server())
        .unwrap_or(Value::Object(Map::new()));
    deep_merge(&mut merged, doc);
    let mut server: OpenSourceFrpcDesktopServer = from_json_lenient(&merged.to_string());
    server.id = "1".to_string();
    server
}

fn normalize_proxy(doc: Value) -> FrpcProxy {
    let mut proxy: FrpcProxy = from_json_lenient(&doc.to_string());
    if proxy.proxy_type.is_empty() {
        proxy.proxy_type = "http".to_string();
    }
    if proxy.custom_domains.is_empty() {
        proxy.custom_domains = vec![String::new()];
    }
    if proxy.locations.is_empty() {
        proxy.locations = vec![String::new()];
    }
    proxy
}

fn deep_merge(base: &mut Value, overlay: Value) {
    match (base, overlay) {
        (Value::Object(base_map), Value::Object(overlay_map)) => {
            for (key, value) in overlay_map {
                if value.is_null() {
                    continue;
                }
                match base_map.get_mut(&key) {
                    Some(existing) => deep_merge(existing, value),
                    None => {
                        base_map.insert(key, value);
                    }
                }
            }
        }
        (base, overlay) => *base = overlay,
    }
}
