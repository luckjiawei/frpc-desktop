use crate::models::FrpcSystemConfiguration;
use rusqlite::{params, Connection, Result};
use std::collections::HashMap;

pub struct AppConfigRepository;

impl AppConfigRepository {
    pub fn get_system_config(conn: &Connection) -> Result<FrpcSystemConfiguration> {
        let mut stmt = conn.prepare(
            "SELECT config_key, config_value FROM t_frpcd_app_config
             WHERE scope_type = 'global' AND scope_id IS NULL AND namespace = 'desktop' AND deleted_at IS NULL"
        )?;

        let rows = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let val: String = row.get(1)?;
            Ok((key, val))
        })?;

        let mut values: HashMap<String, String> = HashMap::new();
        for r in rows {
            if let Ok((k, v)) = r {
                values.insert(k, v);
            }
        }

        let launch_at_startup = values
            .get("launch_at_startup")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);

        let silent_startup = values
            .get("silent_startup")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);

        let auto_connect_on_startup = values
            .get("auto_connect_on_startup")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);

        let language = values
            .get("language")
            .cloned()
            .unwrap_or_else(|| "en-US".to_string());

        Ok(FrpcSystemConfiguration {
            launch_at_startup,
            silent_startup,
            auto_connect_on_startup,
            language,
        })
    }

    pub fn save_system_config(
        conn: &Connection,
        config: &FrpcSystemConfiguration,
    ) -> Result<()> {
        Self::upsert(conn, "launch_at_startup", "boolean", &config.launch_at_startup.to_string())?;
        Self::upsert(conn, "silent_startup", "boolean", &config.silent_startup.to_string())?;
        Self::upsert(conn, "auto_connect_on_startup", "boolean", &config.auto_connect_on_startup.to_string())?;
        Self::upsert(conn, "language", "string", &config.language)?;
        Ok(())
    }

    pub fn save_language(conn: &Connection, language: &str) -> Result<()> {
        Self::upsert(conn, "language", "string", language)
    }

    fn upsert(conn: &Connection, key: &str, val_type: &str, value: &str) -> Result<()> {
        let id = format!("desktop_{}", key);
        conn.execute(
            "INSERT INTO t_frpcd_app_config (
                id, scope_type, scope_id, namespace, config_key, value_type, config_value, is_secret, version, created_at, updated_at
             ) VALUES (?1, 'global', NULL, 'desktop', ?2, ?3, ?4, 0, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(scope_type, COALESCE(scope_id, ''), namespace, config_key) WHERE deleted_at IS NULL
             DO UPDATE SET
                config_value = excluded.config_value,
                value_type = excluded.value_type,
                version = t_frpcd_app_config.version + 1,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![id, key, val_type, value],
        )?;
        Ok(())
    }
}
