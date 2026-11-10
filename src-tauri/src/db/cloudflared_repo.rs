use crate::models::CloudflaredSettings;
use rusqlite::{params, Connection, OptionalExtension, Result};

pub const PROTOCOLS: &[&str] = &["auto", "quic", "http2"];
pub const EDGE_IP_VERSIONS: &[&str] = &["auto", "4", "6"];
pub const LOG_LEVELS: &[&str] = &["debug", "info", "warn", "error"];

pub struct CloudflaredRepository;

impl CloudflaredRepository {
    /// Reads the cloudflared settings of a tunnel; `None` if the tunnel has
    /// no cloudflared row (e.g. it is an frpc tunnel).
    pub fn get(conn: &Connection, tunnel_id: &str) -> Result<Option<CloudflaredSettings>> {
        conn.query_row(
            "SELECT id, cloudflared_version, custom_cloudflared_path, token, protocol,
                    edge_ip_version, log_level
             FROM t_frpcd_cloudflared_tunnels WHERE id = ?1",
            params![tunnel_id],
            |row| {
                Ok(CloudflaredSettings {
                    tunnel_id: row.get(0)?,
                    cloudflared_version: row.get(1)?,
                    custom_cloudflared_path: row.get(2)?,
                    token: row.get(3)?,
                    protocol: row.get(4)?,
                    edge_ip_version: row.get(5)?,
                    log_level: row.get(6)?,
                })
            },
        )
        .optional()
    }

    /// Inserts or updates the row; the tunnel row must exist.
    pub fn save(conn: &Connection, settings: &CloudflaredSettings) -> Result<()> {
        conn.execute(
            "INSERT INTO t_frpcd_cloudflared_tunnels (
                id, cloudflared_version, custom_cloudflared_path, token, protocol,
                edge_ip_version, log_level
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                cloudflared_version = excluded.cloudflared_version,
                custom_cloudflared_path = excluded.custom_cloudflared_path,
                token = excluded.token,
                protocol = excluded.protocol,
                edge_ip_version = excluded.edge_ip_version,
                log_level = excluded.log_level",
            params![
                settings.tunnel_id,
                settings.cloudflared_version,
                settings.custom_cloudflared_path,
                settings.token,
                settings.protocol,
                settings.edge_ip_version,
                settings.log_level,
            ],
        )?;
        Ok(())
    }

    /// Connector tokens are base64 (standard or URL-safe) encoded JSON. Only
    /// that character set is accepted so the value is safe to pass on.
    pub fn is_valid_token(token: &str) -> bool {
        (32..=4096).contains(&token.len())
            && token
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '-' | '_'))
    }

    /// Checks enum fields and the token; returns the invalid field name.
    pub fn validate(settings: &CloudflaredSettings) -> std::result::Result<(), &'static str> {
        if !PROTOCOLS.contains(&settings.protocol.as_str()) {
            return Err("protocol");
        }
        if !EDGE_IP_VERSIONS.contains(&settings.edge_ip_version.as_str()) {
            return Err("edgeIpVersion");
        }
        if !LOG_LEVELS.contains(&settings.log_level.as_str()) {
            return Err("logLevel");
        }
        if !settings.token.is_empty() && !Self::is_valid_token(&settings.token) {
            return Err("token");
        }
        Ok(())
    }
}
