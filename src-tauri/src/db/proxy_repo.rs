use crate::models::{FrpcProxy, FrpcProxyTransportConfig};
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

pub struct ProxyRepository;

impl ProxyRepository {
    pub fn get_all_proxies(conn: &Connection) -> Result<Vec<FrpcProxy>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, type, local_ip, local_port, remote_port,
                    custom_domains_json, locations_json, host_header_rewrite,
                    visitors_model, server_user, server_name, secret_key,
                    bind_addr, bind_port, subdomain, basic_auth, http_user,
                    http_password, fallback_to, fallback_timeout_ms, https2http,
                    https2http_ca_file, https2http_key_file, tls2raw,
                    tls2raw_ca_file, tls2raw_key_file, keep_tunnel_open,
                    status, transport_json
             FROM t_frpcd_proxies",
        )?;

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let proxy_type: String = row.get(2)?;
            let local_ip: String = row.get(3)?;
            let local_port_str: String = row.get(4)?;
            let remote_port_str: String = row.get(5)?;
            let custom_domains_json: String = row.get(6)?;
            let locations_json: String = row.get(7)?;
            let host_header_rewrite: String = row.get(8)?;
            let visitors_model: String = row.get(9)?;
            let server_user: String = row.get(10)?;
            let server_name: String = row.get(11)?;
            let secret_key: String = row.get(12)?;
            let bind_addr: String = row.get(13)?;
            let bind_port: Option<i64> = row.get(14)?;
            let subdomain: String = row.get(15)?;
            let basic_auth_int: i64 = row.get(16)?;
            let http_user: String = row.get(17)?;
            let http_password: String = row.get(18)?;
            let fallback_to: String = row.get(19)?;
            let fallback_timeout_ms: i64 = row.get(20)?;
            let https2http_int: i64 = row.get(21)?;
            let https2http_ca_file: String = row.get(22)?;
            let https2http_key_file: String = row.get(23)?;
            let tls2raw_int: i64 = row.get(24)?;
            let tls2raw_ca_file: String = row.get(25)?;
            let tls2raw_key_file: String = row.get(26)?;
            let keep_tunnel_open_int: i64 = row.get(27)?;
            let status: i64 = row.get(28)?;
            let transport_json: String = row.get(29)?;

            let custom_domains: Vec<String> =
                serde_json::from_str(&custom_domains_json).unwrap_or_default();
            let locations: Vec<String> =
                serde_json::from_str(&locations_json).unwrap_or_default();
            let transport: FrpcProxyTransportConfig =
                serde_json::from_str(&transport_json).unwrap_or_default();

            let local_port = if let Ok(num) = local_port_str.parse::<i64>() {
                serde_json::Value::Number(num.into())
            } else {
                serde_json::Value::String(local_port_str)
            };

            let remote_port = if let Ok(num) = remote_port_str.parse::<i64>() {
                serde_json::Value::Number(num.into())
            } else {
                serde_json::Value::String(remote_port_str)
            };

            Ok(FrpcProxy {
                id,
                name,
                proxy_type,
                local_ip,
                local_port,
                remote_port,
                custom_domains,
                locations,
                host_header_rewrite,
                visitors_model,
                server_user,
                server_name,
                secret_key,
                bind_addr,
                bind_port,
                subdomain,
                basic_auth: basic_auth_int == 1,
                http_user,
                http_password,
                fallback_to,
                fallback_timeout_ms,
                https2http: https2http_int == 1,
                https2http_ca_file,
                https2http_key_file,
                tls2raw: tls2raw_int == 1,
                tls2raw_ca_file,
                tls2raw_key_file,
                keep_tunnel_open: keep_tunnel_open_int == 1,
                status,
                transport,
            })
        })?;

        let mut proxies = Vec::new();
        for r in rows {
            if let Ok(p) = r {
                proxies.push(p);
            }
        }
        Ok(proxies)
    }

    pub fn create_proxy(conn: &Connection, mut proxy: FrpcProxy) -> Result<FrpcProxy> {
        if proxy.id.is_empty() {
            proxy.id = Uuid::new_v4().to_string();
        }
        Self::save_proxy(conn, &proxy)?;
        Ok(proxy)
    }

    pub fn modify_proxy(conn: &Connection, proxy: FrpcProxy) -> Result<FrpcProxy> {
        Self::save_proxy(conn, &proxy)?;
        Ok(proxy)
    }

    pub fn delete_proxy(conn: &Connection, id: &str) -> Result<()> {
        conn.execute("DELETE FROM t_frpcd_proxies WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn modify_proxy_status(conn: &Connection, id: &str, status: i64) -> Result<()> {
        conn.execute(
            "UPDATE t_frpcd_proxies SET status = ? WHERE id = ?",
            params![status, id],
        )?;
        Ok(())
    }

    pub fn get_local_ports(conn: &Connection) -> Result<Vec<String>> {
        let mut stmt = conn.prepare("SELECT local_port FROM t_frpcd_proxies")?;
        let rows = stmt.query_map([], |row| {
            let p: String = row.get(0)?;
            Ok(p)
        })?;
        let mut ports = Vec::new();
        for r in rows {
            if let Ok(p) = r {
                ports.push(p);
            }
        }
        Ok(ports)
    }

    fn save_proxy(conn: &Connection, proxy: &FrpcProxy) -> Result<()> {
        let custom_domains_json = serde_json::to_string(&proxy.custom_domains)
            .unwrap_or_else(|_| "[\"\"]".to_string());
        let locations_json = serde_json::to_string(&proxy.locations)
            .unwrap_or_else(|_| "[\"\"]".to_string());
        let transport_json = serde_json::to_string(&proxy.transport)
            .unwrap_or_else(|_| "{}".to_string());

        let local_port_str = match &proxy.local_port {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => "8080".to_string(),
        };

        let remote_port_str = match &proxy.remote_port {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => "8080".to_string(),
        };

        conn.execute(
            "INSERT INTO t_frpcd_proxies (
                id, server_id, name, type, local_ip, local_port, remote_port,
                custom_domains_json, locations_json, host_header_rewrite,
                visitors_model, server_user, server_name, secret_key,
                bind_addr, bind_port, subdomain, basic_auth, http_user,
                http_password, fallback_to, fallback_timeout_ms, https2http,
                https2http_ca_file, https2http_key_file, tls2raw,
                tls2raw_ca_file, tls2raw_key_file, keep_tunnel_open,
                status, transport_json
            ) VALUES (
                ?1, '1', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25,
                ?26, ?27, ?28, ?29, ?30
            ) ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                local_ip = excluded.local_ip,
                local_port = excluded.local_port,
                remote_port = excluded.remote_port,
                custom_domains_json = excluded.custom_domains_json,
                locations_json = excluded.locations_json,
                host_header_rewrite = excluded.host_header_rewrite,
                visitors_model = excluded.visitors_model,
                server_user = excluded.server_user,
                server_name = excluded.server_name,
                secret_key = excluded.secret_key,
                bind_addr = excluded.bind_addr,
                bind_port = excluded.bind_port,
                subdomain = excluded.subdomain,
                basic_auth = excluded.basic_auth,
                http_user = excluded.http_user,
                http_password = excluded.http_password,
                fallback_to = excluded.fallback_to,
                fallback_timeout_ms = excluded.fallback_timeout_ms,
                https2http = excluded.https2http,
                https2http_ca_file = excluded.https2http_ca_file,
                https2http_key_file = excluded.https2http_key_file,
                tls2raw = excluded.tls2raw,
                tls2raw_ca_file = excluded.tls2raw_ca_file,
                tls2raw_key_file = excluded.tls2raw_key_file,
                keep_tunnel_open = excluded.keep_tunnel_open,
                status = excluded.status,
                transport_json = excluded.transport_json",
            params![
                proxy.id,
                proxy.name,
                proxy.proxy_type,
                proxy.local_ip,
                local_port_str,
                remote_port_str,
                custom_domains_json,
                locations_json,
                proxy.host_header_rewrite,
                proxy.visitors_model,
                proxy.server_user,
                proxy.server_name,
                proxy.secret_key,
                proxy.bind_addr,
                proxy.bind_port,
                proxy.subdomain,
                if proxy.basic_auth { 1 } else { 0 },
                proxy.http_user,
                proxy.http_password,
                proxy.fallback_to,
                proxy.fallback_timeout_ms,
                if proxy.https2http { 1 } else { 0 },
                proxy.https2http_ca_file,
                proxy.https2http_key_file,
                if proxy.tls2raw { 1 } else { 0 },
                proxy.tls2raw_ca_file,
                proxy.tls2raw_key_file,
                if proxy.keep_tunnel_open { 1 } else { 0 },
                proxy.status,
                transport_json,
            ],
        )?;
        Ok(())
    }
}
