use crate::db::app_config_repo::AppConfigRepository;
use crate::models::{
    AuthConfig, LogConfig, OpenSourceFrpcDesktopServer, TransportConfig, WebServerConfig,
};
use rusqlite::{params, Connection, OptionalExtension, Result};
use std::collections::HashMap;

pub struct ServerRepository;

impl ServerRepository {
    pub fn create_default_server() -> OpenSourceFrpcDesktopServer {
        let mut server = OpenSourceFrpcDesktopServer::default();
        server.id = "1".to_string();
        server.server_port = 7000;
        server.udp_packet_size = 1500;
        server.log = LogConfig {
            to: "".to_string(),
            level: "info".to_string(),
            max_days: 3,
            disable_print_color: false,
        };
        server.transport = TransportConfig::default();
        server.transport.tls.enable = true;
        server.transport.tls.disable_custom_tls_first_byte = true;
        server.transport.heartbeat_interval = 30;
        server.transport.heartbeat_timeout = 90;
        server.web_server = WebServerConfig {
            enable: true,
            addr: "127.0.0.1".to_string(),
            port: 57400,
            user: "".to_string(),
            password: "".to_string(),
            pprof_enable: false,
        };
        let mut meta = HashMap::new();
        meta.insert("token".to_string(), serde_json::Value::String("".to_string()));
        server.metadatas = meta;
        server
    }

    pub fn get_server_config(conn: &Connection) -> Result<OpenSourceFrpcDesktopServer> {
        let mut stmt = conn.prepare(
            "SELECT id, frpc_version, multiuser, user, server_addr, server_port,
                    login_fail_exit, udp_packet_size, auth_json, log_json,
                    web_server_json, transport_json, metadatas_json, custom_frpc_path
             FROM t_frpcd_servers WHERE id = '1'",
        )?;

        let server_opt = stmt
            .query_row([], |row| {
                let id: String = row.get(0)?;
                let frpc_version: Option<i64> = row.get(1)?;
                let multiuser_int: i64 = row.get(2)?;
                let user: String = row.get(3)?;
                let server_addr: String = row.get(4)?;
                let server_port: i64 = row.get(5)?;
                let login_fail_exit_int: i64 = row.get(6)?;
                let udp_packet_size: i64 = row.get(7)?;
                let auth_json: String = row.get(8)?;
                let log_json: String = row.get(9)?;
                let web_server_json: String = row.get(10)?;
                let transport_json: String = row.get(11)?;
                let metadatas_json: String = row.get(12)?;
                let custom_frpc_path: String = row.get(13).unwrap_or_default();

                let auth: AuthConfig =
                    serde_json::from_str(&auth_json).unwrap_or_default();
                let log: LogConfig =
                    serde_json::from_str(&log_json).unwrap_or_default();
                let web_server: WebServerConfig =
                    serde_json::from_str(&web_server_json).unwrap_or_default();
                let transport: TransportConfig =
                    serde_json::from_str(&transport_json).unwrap_or_default();
                let metadatas: HashMap<String, serde_json::Value> =
                    serde_json::from_str(&metadatas_json).unwrap_or_default();

                Ok(OpenSourceFrpcDesktopServer {
                    id,
                    frpc_version,
                    custom_frpc_path,
                    multiuser: multiuser_int == 1,
                    user,
                    server_addr,
                    server_port,
                    login_fail_exit: login_fail_exit_int == 1,
                    udp_packet_size,
                    auth,
                    log,
                    web_server,
                    transport,
                    metadatas,
                    system: Default::default(),
                })
            })
            .optional()?;

        let mut server = match server_opt {
            Some(s) => s,
            None => {
                let default_s = Self::create_default_server();
                Self::save_server_config(conn, &default_s)?;
                default_s
            }
        };

        if let Ok(sys) = AppConfigRepository::get_system_config(conn) {
            server.system = sys;
        }

        Ok(server)
    }

    pub fn save_server_config(
        conn: &Connection,
        server: &OpenSourceFrpcDesktopServer,
    ) -> Result<()> {
        let auth_json = serde_json::to_string(&server.auth).unwrap_or_else(|_| "{}".to_string());
        let log_json = serde_json::to_string(&server.log).unwrap_or_else(|_| "{}".to_string());
        let web_server_json =
            serde_json::to_string(&server.web_server).unwrap_or_else(|_| "{}".to_string());
        let transport_json =
            serde_json::to_string(&server.transport).unwrap_or_else(|_| "{}".to_string());
        let metadatas_json =
            serde_json::to_string(&server.metadatas).unwrap_or_else(|_| "{}".to_string());

        conn.execute(
            "INSERT INTO t_frpcd_servers (
                id, frpc_version, multiuser, user, server_addr, server_port,
                login_fail_exit, udp_packet_size, auth_json, log_json,
                web_server_json, transport_json, metadatas_json, custom_frpc_path
            ) VALUES (
                '1', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
            ) ON CONFLICT(id) DO UPDATE SET
                frpc_version = excluded.frpc_version,
                multiuser = excluded.multiuser,
                user = excluded.user,
                server_addr = excluded.server_addr,
                server_port = excluded.server_port,
                login_fail_exit = excluded.login_fail_exit,
                udp_packet_size = excluded.udp_packet_size,
                auth_json = excluded.auth_json,
                log_json = excluded.log_json,
                web_server_json = excluded.web_server_json,
                transport_json = excluded.transport_json,
                metadatas_json = excluded.metadatas_json,
                custom_frpc_path = excluded.custom_frpc_path",
            params![
                server.frpc_version,
                if server.multiuser { 1 } else { 0 },
                server.user,
                server.server_addr,
                server.server_port,
                if server.login_fail_exit { 1 } else { 0 },
                server.udp_packet_size,
                auth_json,
                log_json,
                web_server_json,
                transport_json,
                metadatas_json,
                server.custom_frpc_path,
            ],
        )?;

        AppConfigRepository::save_system_config(conn, &server.system)?;
        Ok(())
    }

    pub fn reset_all_config(conn: &Connection) -> Result<()> {
        conn.execute("DELETE FROM t_frpcd_proxies", [])?;
        conn.execute("DELETE FROM t_frpcd_servers", [])?;
        conn.execute(
            "DELETE FROM t_frpcd_app_config WHERE namespace = 'desktop'",
            [],
        )?;
        let default_s = Self::create_default_server();
        Self::save_server_config(conn, &default_s)?;
        Ok(())
    }
}
