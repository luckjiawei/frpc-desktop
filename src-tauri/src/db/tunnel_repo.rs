use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::models::{Tunnel, TunnelSummary};
use rusqlite::{params, Connection, OptionalExtension, Result, Row};
use std::collections::HashSet;
use uuid::Uuid;

/// The tunnel migrated from the single-server era. It keeps the legacy
/// `frpc.toml` / `frpc.log` paths and cannot be deleted, so older app
/// versions and IPC calls without `tunnelId` keep working.
pub const DEFAULT_TUNNEL_ID: &str = "1";

pub const PROVIDER_FRPC: &str = "frpc";

const DEFAULT_WEB_SERVER_PORT: i64 = 57400;
pub const MAX_TUNNEL_NAME_LEN: usize = 64;

pub struct TunnelRepository;

impl TunnelRepository {
    /// Tunnel IDs are used in filesystem paths, so only accept the default ID
    /// or a canonical UUID.
    pub fn is_valid_id(id: &str) -> bool {
        id == DEFAULT_TUNNEL_ID
            || Uuid::parse_str(id).map_or(false, |u| u.hyphenated().to_string() == id)
    }

    pub fn is_supported_provider(provider: &str) -> bool {
        provider == PROVIDER_FRPC
    }

    fn map_row(row: &Row) -> Result<Tunnel> {
        Ok(Tunnel {
            id: row.get(0)?,
            name: row.get(1)?,
            provider: row.get(2)?,
            auto_start: row.get::<_, i64>(3)? == 1,
            sort_order: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }

    pub fn list(conn: &Connection) -> Result<Vec<Tunnel>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, provider, auto_start, sort_order, created_at, updated_at
             FROM t_frpcd_tunnels ORDER BY sort_order, created_at",
        )?;
        let rows = stmt.query_map([], Self::map_row)?;
        rows.collect()
    }

    pub fn find(conn: &Connection, id: &str) -> Result<Option<Tunnel>> {
        conn.query_row(
            "SELECT id, name, provider, auto_start, sort_order, created_at, updated_at
             FROM t_frpcd_tunnels WHERE id = ?1",
            params![id],
            Self::map_row,
        )
        .optional()
    }

    pub fn list_summaries(conn: &Connection) -> Result<Vec<TunnelSummary>> {
        let mut summaries = Vec::new();
        for tunnel in Self::list(conn)? {
            let server = ServerRepository::get_server_config(conn, &tunnel.id)?;
            let proxies = ProxyRepository::get_proxies_by_server(conn, &tunnel.id)?;
            summaries.push(TunnelSummary {
                server_addr: server.server_addr,
                server_port: server.server_port,
                proxy_total: proxies.len(),
                proxy_enabled: proxies.iter().filter(|p| p.status == 1).count(),
                tunnel,
            });
        }
        Ok(summaries)
    }

    /// Re-creates the default tunnel row if it is missing (e.g. a downgraded
    /// build removed it).
    pub fn ensure_default(conn: &Connection) -> Result<()> {
        conn.execute(
            "INSERT OR IGNORE INTO t_frpcd_tunnels (id, name, provider, auto_start, sort_order)
             VALUES (?1, 'Default', ?2, 1, 0)",
            params![DEFAULT_TUNNEL_ID, PROVIDER_FRPC],
        )?;
        Ok(())
    }

    /// Creates a tunnel and its provider settings in one transaction.
    pub fn create(conn: &mut Connection, name: &str, provider: &str) -> Result<Tunnel> {
        let tx = conn.transaction()?;
        let id = Uuid::new_v4().to_string();
        let next_order: i64 = tx.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM t_frpcd_tunnels",
            [],
            |r| r.get(0),
        )?;
        tx.execute(
            "INSERT INTO t_frpcd_tunnels (id, name, provider, auto_start, sort_order)
             VALUES (?1, ?2, ?3, 0, ?4)",
            params![id, name, provider, next_order],
        )?;

        if provider == PROVIDER_FRPC {
            let mut server = ServerRepository::create_default_server();
            server.id = id.clone();
            server.web_server.port = Self::next_free_web_server_port(&tx)?;
            ServerRepository::save_frpc_settings(&tx, &server)?;
        }

        let tunnel = Self::find(&tx, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        tx.commit()?;
        Ok(tunnel)
    }

    pub fn update(
        conn: &Connection,
        id: &str,
        name: Option<&str>,
        auto_start: Option<bool>,
    ) -> Result<Option<Tunnel>> {
        conn.execute(
            "UPDATE t_frpcd_tunnels SET
                name = COALESCE(?2, name),
                auto_start = COALESCE(?3, auto_start),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?1",
            params![id, name, auto_start.map(|v| if v { 1 } else { 0 })],
        )?;
        Self::find(conn, id)
    }

    /// Deletes a non-default tunnel; servers and proxies cascade.
    pub fn delete(conn: &Connection, id: &str) -> Result<bool> {
        if id == DEFAULT_TUNNEL_ID {
            return Ok(false);
        }
        let affected = conn.execute("DELETE FROM t_frpcd_tunnels WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    /// Removes every tunnel except the default one and resets its row.
    pub fn reset(conn: &Connection) -> Result<()> {
        conn.execute(
            "DELETE FROM t_frpcd_tunnels WHERE id <> ?1",
            params![DEFAULT_TUNNEL_ID],
        )?;
        Self::ensure_default(conn)?;
        conn.execute(
            "UPDATE t_frpcd_tunnels SET auto_start = 1, sort_order = 0,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?1",
            params![DEFAULT_TUNNEL_ID],
        )?;
        Ok(())
    }

    /// New frpc tunnels get their own admin port so they can run alongside
    /// existing ones.
    fn next_free_web_server_port(conn: &Connection) -> Result<i64> {
        let mut stmt =
            conn.prepare("SELECT json_extract(web_server_json, '$.port') FROM t_frpcd_servers")?;
        let used: HashSet<i64> = stmt
            .query_map([], |r| r.get::<_, Option<i64>>(0))?
            .filter_map(|r| r.ok().flatten())
            .collect();
        let mut port = DEFAULT_WEB_SERVER_PORT;
        while used.contains(&port) && port < 65535 {
            port += 1;
        }
        Ok(port)
    }
}
