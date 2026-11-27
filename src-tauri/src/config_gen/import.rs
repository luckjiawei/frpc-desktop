//! Pure import of the subset of modern frpc TOML represented by the desktop models.
//!
//! Unsupported fields are rejected rather than lost when the imported settings are
//! generated again. Errors contain only known field paths or syntax locations;
//! neither TOML errors nor user-supplied keys/values may be included in them.

use crate::models::{
    AuthConfig, FrpcProxy, FrpcProxyTransportConfig, LogConfig, OpenSourceFrpcDesktopServer,
    TransportConfig, TransportTlsConfig, WebServerConfig,
};
use anyhow::{bail, Result};
use std::collections::{HashMap, HashSet};
use std::path::{Component, Path, PathBuf};
use toml::{Table, Value};

/// Parse modern frpc TOML without performing file, network, or database I/O.
///
/// Desktop identity, executable selection and system preferences come from
/// `current`. Missing frpc settings reset to application/frpc defaults, except
/// that an omitted `webServer` retains the instance's allocated monitoring API.
/// An explicit `webServer.port = 0` disables that API. New proxies have empty IDs,
/// belong to the current tunnel, and are enabled; persistence allocates their IDs.
/// Relative certificate paths are resolved against `base_dir` (the imported
/// file's directory) because frpc would otherwise resolve them against its own
/// working directory. Go-template port ranges and fields the generator cannot
/// represent are rejected.
pub fn parse_toml_config(
    content: &str,
    current: &OpenSourceFrpcDesktopServer,
    base_dir: Option<&Path>,
) -> Result<(OpenSourceFrpcDesktopServer, Vec<FrpcProxy>)> {
    let table: Table = toml::from_str(content).map_err(|error: toml::de::Error| {
        // Displaying the original error would include the input, including secrets.
        if let Some(span) = error.span() {
            let prefix = content.get(..span.start.min(content.len())).unwrap_or("");
            let line = prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
            let column = prefix.rsplit('\n').next().unwrap_or("").chars().count() + 1;
            anyhow::anyhow!("Invalid TOML at line {line}, column {column}")
        } else {
            anyhow::anyhow!("Invalid TOML")
        }
    })?;
    let mut root = Fields::new(table, "config");
    let server_addr = root.required_string("serverAddr")?;
    validate_nonempty(&server_addr, "serverAddr")?;
    let user = root.string("user", "")?;
    let mut server = OpenSourceFrpcDesktopServer {
        id: current.id.clone(),
        frpc_version: current.frpc_version,
        custom_frpc_path: current.custom_frpc_path.clone(),
        system: current.system.clone(),
        multiuser: !user.is_empty(),
        user,
        server_addr,
        server_port: root.integer("serverPort", 7000, 1, 65535)?,
        login_fail_exit: root.boolean("loginFailExit", false)?,
        udp_packet_size: root.integer("udpPacketSize", 1500, 1, 65535)?,
        auth: AuthConfig {
            method: "token".to_string(),
            token: String::new(),
            oidc: Default::default(),
        },
        log: LogConfig {
            to: String::new(),
            level: "info".to_string(),
            max_days: 3,
            disable_print_color: false,
        },
        web_server: current.web_server.clone(),
        transport: TransportConfig {
            dial_server_timeout: 10,
            dial_server_keepalive: 7200,
            pool_count: 0,
            tcp_mux: true,
            tcp_mux_keepalive_interval: 30,
            protocol: "tcp".to_string(),
            heartbeat_interval: 30,
            heartbeat_timeout: 90,
            tls: TransportTlsConfig {
                enable: true,
                disable_custom_tls_first_byte: true,
                ..Default::default()
            },
            ..Default::default()
        },
        metadatas: Default::default(),
    };
    if let Some(mut auth) = root.table("auth")? {
        server.auth.method = auth.string("method", "token")?;
        match server.auth.method.as_str() {
            "token" => {
                server.auth.token = auth.string("token", "")?;
            }
            "oidc" => {
                // These modern TOML fields are accepted by frpc v0.52.0 and
                // newer, this app's support floor for the config. The three
                // fields frpc cannot authenticate without must be present so a
                // broken file is reported instead of being saved silently.
                if let Some(mut oidc) = auth.table("oidc")? {
                    server.auth.oidc.client_id = oidc.string("clientID", "")?;
                    server.auth.oidc.client_secret = oidc.string("clientSecret", "")?;
                    server.auth.oidc.token_endpoint_url = oidc.string("tokenEndpointURL", "")?;
                    server.auth.oidc.audience = oidc.string("audience", "")?;
                    server.auth.oidc.scope = oidc.string("scope", "")?;
                    if let Some(mut params) = oidc.table("additionalEndpointParams")? {
                        server.auth.oidc.additional_endpoint_params =
                            params.string_map_strings()?;
                    }
                    oidc.finish()?;
                }
                validate_nonempty(&server.auth.oidc.client_id, "auth.oidc.clientID")?;
                validate_nonempty(&server.auth.oidc.client_secret, "auth.oidc.clientSecret")?;
                validate_http_url(
                    &server.auth.oidc.token_endpoint_url,
                    "auth.oidc.tokenEndpointURL",
                )?;
            }
            "none" => {}
            _ => bail!("Unsupported field value at auth.method"),
        }
        auth.finish()?;
    }
    if let Some(mut log) = root.table("log")? {
        // The destination is desktop-managed: every instance logs to its own
        // path (see `AppState::tunnel_paths`). Keeping an imported `to` would
        // point frpc at another installation's file and leave this instance's
        // log viewer empty, so only validate the value and drop it.
        log.string("to", "")?;
        server.log.level = log.string("level", "info")?;
        if !["trace", "debug", "info", "warn", "error"].contains(&server.log.level.as_str()) {
            bail!("Invalid field at log.level");
        }
        server.log.max_days = log.integer("maxDays", 3, 0, i64::MAX)?;
        server.log.disable_print_color = log.boolean("disablePrintColor", false)?;
        log.finish()?;
    }
    if let Some(mut web) = root.table("webServer")? {
        let port = web.integer("port", 0, 0, 65535)?;
        server.web_server = WebServerConfig {
            enable: port > 0,
            addr: web.string("addr", "127.0.0.1")?,
            port,
            user: web.string("user", "")?,
            password: web.string("password", "")?,
            pprof_enable: web.boolean("pprofEnable", false)?,
        };
        web.finish()?;
    }
    if let Some(mut transport) = root.table("transport")? {
        let t = &mut server.transport;
        t.dial_server_timeout = transport.integer("dialServerTimeout", 10, 0, i64::MAX)?;
        t.dial_server_keepalive = transport.integer("dialServerKeepalive", 7200, 0, i64::MAX)?;
        t.pool_count = transport.integer("poolCount", 0, 0, i64::MAX)?;
        t.tcp_mux = transport.boolean("tcpMux", true)?;
        t.tcp_mux_keepalive_interval =
            transport.integer("tcpMuxKeepaliveInterval", 30, 0, i64::MAX)?;
        t.protocol = transport.string("protocol", "tcp")?;
        if !["tcp", "kcp", "quic", "websocket", "wss"].contains(&t.protocol.as_str()) {
            bail!("Invalid field at transport.protocol");
        }
        t.connect_server_local_ip = transport.string("connectServerLocalIP", "")?;
        t.proxy_url = transport.string("proxyURL", "")?;
        // The generator emits positive heartbeat settings only. In particular,
        // accepting frpc's -1 sentinel would silently re-enable heartbeats.
        // frpc also rejects heartbeatTimeout < heartbeatInterval, so raise the
        // timeout to the imported interval instead of rejecting the config.
        t.heartbeat_interval = transport.integer("heartbeatInterval", 30, 1, i64::MAX)?;
        t.heartbeat_timeout = transport.integer("heartbeatTimeout", 90, 1, i64::MAX)?;
        if t.heartbeat_timeout < t.heartbeat_interval {
            t.heartbeat_timeout = t.heartbeat_interval;
        }
        if let Some(mut tls) = transport.table("tls")? {
            t.tls.enable = tls.boolean("enable", true)?;
            t.tls.cert_file = resolve_config_path(tls.string("certFile", "")?, base_dir);
            t.tls.key_file = resolve_config_path(tls.string("keyFile", "")?, base_dir);
            t.tls.trusted_ca_file = resolve_config_path(tls.string("trustedCaFile", "")?, base_dir);
            t.tls.server_name = tls.string("serverName", "")?;
            t.tls.disable_custom_tls_first_byte = tls.boolean("disableCustomTLSFirstByte", true)?;
            tls.finish()?;
        }
        transport.finish()?;
    }
    // frps plugins commonly require custom metadata (for example an instance
    // ID), so preserve it and let the generator emit it again.
    if let Some(mut metadatas) = root.table("metadatas")? {
        server.metadatas = metadatas.string_map()?;
    }
    let mut proxies = Vec::new();
    let mut names = HashSet::new();
    for (collection, visitor) in [("proxies", false), ("visitors", true)] {
        for mut fields in root.tables(collection)? {
            let proxy = parse_proxy(&mut fields, visitor, &current.id, base_dir)?;
            if !names.insert(proxy.name.clone()) {
                bail!("Duplicate name at {}.name", fields.path);
            }
            fields.finish()?;
            proxies.push(proxy);
        }
    }
    root.finish()?;
    Ok((server, proxies))
}

fn parse_proxy(
    fields: &mut Fields,
    visitor: bool,
    server_id: &str,
    base_dir: Option<&Path>,
) -> Result<FrpcProxy> {
    let name = fields.required_string("name")?;
    validate_nonempty(&name, &fields.field("name"))?;
    let proxy_type = fields.string("type", "tcp")?;
    let supported = if visitor {
        ["stcp", "xtcp", "sudp"].contains(&proxy_type.as_str())
    } else {
        ["tcp", "udp", "http", "https", "stcp", "xtcp", "sudp"].contains(&proxy_type.as_str())
    };
    if !supported {
        bail!("Invalid field at {}", fields.field("type"));
    }
    let mut proxy = FrpcProxy {
        name,
        proxy_type,
        server_id: server_id.to_string(),
        visitors_model: if visitor {
            "visitors"
        } else {
            "visitorsProvider"
        }
        .to_string(),
        status: 1,
        local_port: serde_json::Value::String(String::new()),
        remote_port: serde_json::Value::String(String::new()),
        fallback_timeout_ms: 500,
        ..Default::default()
    };
    if visitor {
        proxy.server_name = fields.required_string("serverName")?;
        validate_nonempty(&proxy.server_name, &fields.field("serverName"))?;
        proxy.server_user = fields.string("serverUser", "")?;
        proxy.secret_key = fields.string("secretKey", "")?;
        proxy.bind_addr = fields.string("bindAddr", "127.0.0.1")?;
        // The desktop database cannot represent frpc's listener-free -1 sentinel.
        // Require a supported listener port before persistence is attempted.
        let Some(port) = fields.optional_integer("bindPort", 1, 65535)? else {
            bail!("Missing field at {}", fields.field("bindPort"));
        };
        proxy.bind_port = Some(port);
        if proxy.proxy_type == "xtcp" {
            proxy.keep_tunnel_open = fields.boolean("keepTunnelOpen", false)?;
            proxy.fallback_to = fields.string("fallbackTo", "")?;
            proxy.fallback_timeout_ms = fields.integer("fallbackTimeoutMs", 500, 0, i64::MAX)?;
        }
        return Ok(proxy);
    }

    let local_port = fields.optional_integer("localPort", 1, 65535)?;
    let explicit_local_ip = fields.values.contains_key("localIP");
    proxy.local_ip = fields.string("localIP", "127.0.0.1")?;
    if let Some(port) = local_port {
        proxy.local_port = serde_json::Value::String(port.to_string());
    }
    match proxy.proxy_type.as_str() {
        "tcp" | "udp" => {
            // Zero asks frps to allocate a remote port dynamically.
            let remote_port = fields.integer("remotePort", 0, 0, 65535)?;
            proxy.remote_port = serde_json::Value::String(remote_port.to_string());
        }
        "http" | "https" => {
            proxy.custom_domains = fields.strings("customDomains")?;
            proxy.subdomain = fields.string("subdomain", "")?;
            proxy.locations = fields.strings("locations")?;
            proxy.host_header_rewrite = fields.string("hostHeaderRewrite", "")?;
            let has_auth = fields.values.contains_key("httpUser")
                || fields.values.contains_key("httpPassword");
            proxy.http_user = fields.string("httpUser", "")?;
            proxy.http_password = fields.string("httpPassword", "")?;
            proxy.basic_auth = has_auth;
        }
        _ => proxy.secret_key = fields.string("secretKey", "")?,
    }
    if let Some(mut plugin) = fields.table("plugin")? {
        let kind = plugin.required_string("type")?;
        match (kind.as_str(), proxy.proxy_type.as_str()) {
            ("https2http", "https") => proxy.https2http = true,
            ("tls2raw", "tcp" | "https") => proxy.tls2raw = true,
            _ => bail!("Unsupported field value at {}", plugin.field("type")),
        }
        let address = plugin.required_string("localAddr")?;
        let (host, port) = parse_local_addr(&address, &plugin.field("localAddr"))?;
        // tcp+tls2raw generated by this app includes both endpoint forms. Reject
        // disagreement rather than silently choosing which target to overwrite.
        if local_port.is_some_and(|local| local != port)
            || (explicit_local_ip && proxy.local_ip != host)
        {
            bail!("Conflicting endpoint at {}", plugin.field("localAddr"));
        }
        proxy.local_ip = host;
        proxy.local_port = serde_json::Value::String(port.to_string());
        let cert = resolve_config_path(plugin.string("crtPath", "")?, base_dir);
        let key = resolve_config_path(plugin.string("keyPath", "")?, base_dir);
        if proxy.https2http {
            proxy.https2http_ca_file = cert;
            proxy.https2http_key_file = key;
        } else {
            proxy.tls2raw_ca_file = cert;
            proxy.tls2raw_key_file = key;
        }
        plugin.finish()?;
    } else if local_port.is_none() {
        bail!("Missing field at {}", fields.field("localPort"));
    }
    if let Some(mut transport) = fields.table("transport")? {
        proxy.transport = FrpcProxyTransportConfig {
            use_encryption: transport.boolean("useEncryption", false)?,
            use_compression: transport.boolean("useCompression", false)?,
            proxy_protocol_version: transport.string("proxyProtocolVersion", "")?,
        };
        if !["", "v1", "v2"].contains(&proxy.transport.proxy_protocol_version.as_str()) {
            bail!(
                "Invalid field at {}",
                transport.field("proxyProtocolVersion")
            );
        }
        transport.finish()?;
    }
    Ok(proxy)
}

fn parse_local_addr(address: &str, path: &str) -> Result<(String, i64)> {
    let Some((host, port)) = address.rsplit_once(':') else {
        bail!("Invalid field at {path}");
    };
    let host = if host.starts_with('[') && host.ends_with(']') {
        &host[1..host.len() - 1]
    } else {
        host
    };
    if host.is_empty()
        || host
            .chars()
            .any(|c| c.is_whitespace() || c.is_control() || "/[]".contains(c))
        || port.is_empty()
        || !port.bytes().all(|b| b.is_ascii_digit())
    {
        bail!("Invalid field at {path}");
    }
    let port = port.parse::<i64>().ok().filter(|p| (1..=65535).contains(p));
    match port {
        Some(port) => Ok((host.to_string(), port)),
        None => bail!("Invalid field at {path}"),
    }
}

/// Resolve a relative config file path against the imported file's directory.
///
/// frpc resolves relative paths against its own working directory, not the
/// location of the TOML file, so keeping them unchanged would point at a file
/// that does not exist after import. Empty values and absolute paths are left
/// untouched; `..` components are preserved because they still need resolving.
fn resolve_config_path(value: String, base_dir: Option<&Path>) -> String {
    let Some(base_dir) = base_dir else {
        return value;
    };
    if value.is_empty() || Path::new(&value).is_absolute() {
        return value;
    }
    let joined = base_dir.join(&value);
    // Drop `.` components so paths such as `./cert.pem` stay readable.
    let mut normalized = PathBuf::new();
    for component in joined.components() {
        if !matches!(component, Component::CurDir) {
            normalized.push(component);
        }
    }
    normalized.to_string_lossy().into_owned()
}

fn validate_http_url(value: &str, path: &str) -> Result<()> {
    let rest = value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"));
    if rest.map_or(true, |rest| rest.is_empty() || rest.starts_with('/')) {
        bail!("Invalid field at {path}");
    }
    Ok(())
}

fn validate_nonempty(value: &str, path: &str) -> Result<()> {
    if value.trim().is_empty() || value != value.trim() || value.chars().any(char::is_control) {
        bail!("Invalid field at {path}");
    }
    Ok(())
}

/// Consumes known fields, making unsupported fields and incorrect types errors.
/// Paths are built exclusively from constants and array indices, never TOML keys.
struct Fields {
    values: Table,
    path: String,
}

impl Fields {
    fn new(values: Table, path: impl Into<String>) -> Self {
        Self {
            values,
            path: path.into(),
        }
    }

    fn field(&self, name: &str) -> String {
        if self.path == "config" {
            name.to_string()
        } else {
            format!("{}.{name}", self.path)
        }
    }

    fn string(&mut self, name: &str, default: &str) -> Result<String> {
        match self.values.remove(name) {
            Some(Value::String(value)) => Ok(value),
            None => Ok(default.to_string()),
            _ => bail!("Expected string at {}", self.field(name)),
        }
    }

    fn required_string(&mut self, name: &str) -> Result<String> {
        if !self.values.contains_key(name) {
            bail!("Missing field at {}", self.field(name));
        }
        self.string(name, "")
    }

    fn boolean(&mut self, name: &str, default: bool) -> Result<bool> {
        match self.values.remove(name) {
            Some(Value::Boolean(value)) => Ok(value),
            None => Ok(default),
            _ => bail!("Expected boolean at {}", self.field(name)),
        }
    }

    fn optional_integer(&mut self, name: &str, min: i64, max: i64) -> Result<Option<i64>> {
        match self.values.remove(name) {
            Some(Value::Integer(value)) if (min..=max).contains(&value) => Ok(Some(value)),
            None => Ok(None),
            _ => bail!(
                "Expected integer in range {min}..{max} at {}",
                self.field(name)
            ),
        }
    }

    fn integer(&mut self, name: &str, default: i64, min: i64, max: i64) -> Result<i64> {
        Ok(self.optional_integer(name, min, max)?.unwrap_or(default))
    }

    fn strings(&mut self, name: &str) -> Result<Vec<String>> {
        match self.values.remove(name) {
            Some(Value::Array(values)) => values
                .into_iter()
                .map(|value| match value {
                    Value::String(value) => Ok(value),
                    _ => bail!("Expected string array at {}", self.field(name)),
                })
                .collect(),
            None => Ok(Vec::new()),
            _ => bail!("Expected string array at {}", self.field(name)),
        }
    }

    fn table(&mut self, name: &str) -> Result<Option<Self>> {
        match self.values.remove(name) {
            Some(Value::Table(table)) => Ok(Some(Self::new(table, self.field(name)))),
            None => Ok(None),
            _ => bail!("Expected table at {}", self.field(name)),
        }
    }

    fn tables(&mut self, name: &str) -> Result<Vec<Self>> {
        match self.values.remove(name) {
            Some(Value::Array(values)) => values
                .into_iter()
                .enumerate()
                .map(|(index, value)| match value {
                    Value::Table(table) => Ok(Self::new(table, format!("{name}[{index}]"))),
                    _ => bail!("Expected table at {name}[{index}]"),
                })
                .collect(),
            None => Ok(Vec::new()),
            _ => bail!("Expected array of tables at {}", self.field(name)),
        }
    }

    /// Consumes every remaining entry as a string value. Keys come from the
    /// input, so errors never echo them.
    fn string_map(&mut self) -> Result<HashMap<String, serde_json::Value>> {
        let mut map = HashMap::new();
        for (key, value) in std::mem::take(&mut self.values) {
            match value {
                Value::String(value) => {
                    map.insert(key, serde_json::Value::String(value));
                }
                _ => bail!("Expected string in {}", self.path),
            }
        }
        Ok(map)
    }

    /// Consumes every remaining entry as a string value, like `string_map`,
    /// but for maps that are stored as plain strings.
    fn string_map_strings(&mut self) -> Result<HashMap<String, String>> {
        let mut map = HashMap::new();
        for (key, value) in std::mem::take(&mut self.values) {
            if key.is_empty() {
                bail!("Invalid field in {}", self.path);
            }
            match value {
                Value::String(value) => {
                    map.insert(key, value);
                }
                _ => bail!("Expected string in {}", self.path),
            }
        }
        Ok(map)
    }

    fn finish(&self) -> Result<()> {
        if !self.values.is_empty() {
            // Unknown keys themselves can contain secrets. Only report the known
            // containing table, never the arbitrary key supplied by the input.
            bail!("Unsupported field in {}", self.path);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_gen::ConfigGenerator;
    use std::path::Path;

    fn current_server() -> OpenSourceFrpcDesktopServer {
        OpenSourceFrpcDesktopServer {
            id: "test-tunnel".to_string(),
            frpc_version: Some(42),
            custom_frpc_path: "/example/frpc".to_string(),
            web_server: WebServerConfig {
                enable: true,
                addr: "127.0.0.1".to_string(),
                port: 57401,
                user: "example-user".to_string(),
                password: "example-password".to_string(),
                pprof_enable: false,
            },
            system: crate::models::FrpcSystemConfiguration {
                launch_at_startup: true,
                silent_startup: true,
                auto_connect_on_startup: true,
                language: "zh-CN".to_string(),
                app_log_level: "info".to_string(),
            },
            // Previous frpc values must not leak into the imported file.
            server_addr: "old.example.test".to_string(),
            server_port: 8000,
            user: "old-user".to_string(),
            multiuser: true,
            auth: AuthConfig {
                method: "token".to_string(),
                token: "old-example-token".to_string(),
                oidc: Default::default(),
            },
            ..Default::default()
        }
    }

    #[test]
    fn minimal_import_resets_frpc_defaults_and_preserves_desktop_settings() {
        let current = current_server();
        let (server, proxies) =
            parse_toml_config("serverAddr = 'frps.example.test'", &current, None).unwrap();
        assert!(proxies.is_empty());
        assert_eq!(server.id, current.id);
        assert_eq!(server.frpc_version, current.frpc_version);
        assert_eq!(server.custom_frpc_path, current.custom_frpc_path);
        assert_eq!(
            serde_json::to_value(&server.system).unwrap(),
            serde_json::to_value(&current.system).unwrap()
        );
        assert_eq!(
            serde_json::to_value(&server.web_server).unwrap(),
            serde_json::to_value(&current.web_server).unwrap()
        );
        assert_eq!(server.server_addr, "frps.example.test");
        assert_eq!(server.server_port, 7000);
        assert!(!server.login_fail_exit);
        assert!(!server.multiuser);
        assert!(server.user.is_empty());
        assert_eq!(server.udp_packet_size, 1500);
        assert_eq!(server.auth.method, "token");
        assert!(server.auth.token.is_empty());
        assert_eq!(server.log.level, "info");
        assert_eq!(server.log.max_days, 3);
        assert_eq!(server.transport.dial_server_timeout, 10);
        assert_eq!(server.transport.dial_server_keepalive, 7200);
        assert_eq!(server.transport.tcp_mux_keepalive_interval, 30);
        assert_eq!(server.transport.protocol, "tcp");
        assert!(server.transport.tcp_mux);
        assert!(server.transport.tls.enable);
        assert!(server.transport.tls.disable_custom_tls_first_byte);
        assert_eq!(server.transport.heartbeat_interval, 30);
        assert_eq!(server.transport.heartbeat_timeout, 90);
    }

    #[test]
    fn heartbeat_timeout_is_raised_to_the_imported_interval() {
        let (server, _) = parse_toml_config(
            "serverAddr = 'example.test'\n[transport]\nheartbeatInterval = 120\nheartbeatTimeout = 10",
            &current_server(),
            None,
        )
        .unwrap();
        assert_eq!(server.transport.heartbeat_interval, 120);
        assert_eq!(server.transport.heartbeat_timeout, 120);

        // An omitted timeout uses the 90s default, which must also be raised
        // when the imported interval is longer.
        let (server, _) = parse_toml_config(
            "serverAddr = 'example.test'\n[transport]\nheartbeatInterval = 120",
            &current_server(),
            None,
        )
        .unwrap();
        assert_eq!(server.transport.heartbeat_timeout, 120);

        let (server, _) = parse_toml_config(
            "serverAddr = 'example.test'\n[transport]\nheartbeatInterval = 30\nheartbeatTimeout = 90",
            &current_server(),
            None,
        )
        .unwrap();
        assert_eq!(server.transport.heartbeat_timeout, 90);
    }

    #[test]
    fn metadatas_survive_import_and_regeneration() {
        let input = r#"
serverAddr = "example.test"
[metadatas]
id = "example-id"
token = "meta-token"
note = "quoted \"value\""
"#;
        let current = current_server();
        let (server, proxies) = parse_toml_config(input, &current, None).unwrap();
        assert_eq!(server.metadatas["id"], "example-id");
        assert_eq!(server.metadatas["token"], "meta-token");

        let generated =
            ConfigGenerator::gen_toml_config(&server, &proxies, Path::new("/example/frpc.log"));
        let (reimported, _) = parse_toml_config(&generated, &current, None).unwrap();
        assert_eq!(reimported.metadatas, server.metadatas);
    }

    #[test]
    fn non_string_metadata_is_preserved_as_text() {
        let mut server = current_server();
        server.log.level = "info".into();
        server.transport.protocol = "tcp".into();
        server
            .metadatas
            .insert("count".into(), serde_json::json!(3));
        server
            .metadatas
            .insert("enabled".into(), serde_json::json!(true));

        let generated =
            ConfigGenerator::gen_toml_config(&server, &[], Path::new("/example/frpc.log"));
        let (reimported, _) = parse_toml_config(&generated, &current_server(), None).unwrap();

        assert_eq!(reimported.metadatas["count"], "3");
        assert_eq!(reimported.metadatas["enabled"], "true");
    }

    #[test]
    fn empty_default_metadata_token_is_only_emitted_in_multiuser_mode() {
        let mut server = current_server();
        server.log.level = "info".into();
        server.transport.protocol = "tcp".into();
        server.multiuser = false;
        server.user.clear();
        server
            .metadatas
            .insert("token".into(), serde_json::json!(""));

        let generated =
            ConfigGenerator::gen_toml_config(&server, &[], Path::new("/example/frpc.log"));
        let (reimported, _) = parse_toml_config(&generated, &current_server(), None).unwrap();
        assert!(!reimported.metadatas.contains_key("token"));

        server.multiuser = true;
        server.user = "example-user".into();
        let generated =
            ConfigGenerator::gen_toml_config(&server, &[], Path::new("/example/frpc.log"));
        let (reimported, _) = parse_toml_config(&generated, &current_server(), None).unwrap();
        assert_eq!(reimported.metadatas["token"], "");
    }

    #[test]
    fn imported_log_destination_yields_to_the_instance_log_path() {
        let (server, _) = parse_toml_config(
            "serverAddr = 'example.test'\n[log]\nto = '/other/tunnel/frpc.log'\nlevel = 'debug'",
            &current_server(),
            None,
        )
        .unwrap();
        // Honoring the imported path would write frpc output somewhere this
        // instance's log viewer never reads.
        assert!(server.log.to.is_empty());
        assert_eq!(server.log.level, "debug");
        let generated = ConfigGenerator::gen_toml_config(
            &server,
            &[],
            Path::new("/app/log/tunnels/example/frpc.log"),
        );
        assert!(generated.contains("to = \"/app/log/tunnels/example/frpc.log\""));
        assert!(!generated.contains("/other/tunnel/frpc.log"));
    }

    #[test]
    fn explicit_web_server_replaces_allocated_api_and_zero_disables_it() {
        let current = current_server();
        let (server, _) = parse_toml_config(
            "serverAddr = 'example.test'\n[webServer]\nport = 7500",
            &current,
            None,
        )
        .unwrap();
        assert!(server.web_server.enable);
        assert_eq!(server.web_server.port, 7500);
        assert_eq!(server.web_server.addr, "127.0.0.1");
        assert!(server.web_server.password.is_empty());
        let (server, _) = parse_toml_config(
            "serverAddr = 'example.test'\n[webServer]\nport = 0",
            &current,
            None,
        )
        .unwrap();
        assert!(!server.web_server.enable);
        assert_eq!(server.web_server.port, 0);
    }

    #[test]
    fn full_supported_generator_roundtrip() {
        let input = r#"
serverAddr = "frps.example.test"
serverPort = 7443
loginFailExit = true
udpPacketSize = 1400
user = "example-user"
[log]
to = "/example/frpc.log"
level = "debug"
maxDays = 7
disablePrintColor = true
[auth]
method = "token"
token = "example-token"
[webServer]
addr = "127.0.0.1"
port = 57402
user = "example-admin"
password = "example-password"
pprofEnable = true
[transport]
dialServerTimeout = 12
dialServerKeepalive = 300
poolCount = 2
tcpMux = false
tcpMuxKeepaliveInterval = 45
protocol = "wss"
connectServerLocalIP = "127.0.0.2"
proxyURL = "http://proxy.example.test:8080"
heartbeatInterval = 35
heartbeatTimeout = 100
[transport.tls]
enable = true
certFile = "/example/client.pem"
keyFile = "/example/client.key"
trustedCaFile = "/example/ca.pem"
serverName = "tls.example.test"
disableCustomTLSFirstByte = false
[[proxies]]
name = "tcp-example"
type = "tcp"
localIP = "127.0.0.2"
localPort = 8081
remotePort = 9001
[proxies.transport]
useEncryption = true
useCompression = true
proxyProtocolVersion = "v2"
[[proxies]]
name = "udp-example"
type = "udp"
localPort = 5353
remotePort = 9002
[[proxies]]
name = "http-example"
type = "http"
localIP = "127.0.0.1"
localPort = 8080
customDomains = ["http.example.test", "other.example.test"]
subdomain = "example"
locations = ["/one", "/two"]
hostHeaderRewrite = "backend.example.test"
httpUser = "example-user"
httpPassword = "example-password"
[[proxies]]
name = "https-example"
type = "https"
customDomains = ["https.example.test"]
[proxies.plugin]
type = "https2http"
localAddr = "127.0.0.1:8082"
crtPath = "/example/plugin.pem"
keyPath = "/example/plugin.key"
[proxies.transport]
useEncryption = true
[[proxies]]
name = "tls-example"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8083
remotePort = 9003
[proxies.plugin]
type = "tls2raw"
localAddr = "127.0.0.1:8083"
crtPath = "/example/tls.pem"
keyPath = "/example/tls.key"
[[proxies]]
name = "stcp-example"
type = "stcp"
localPort = 8084
secretKey = "example-secret"
[[proxies]]
name = "sudp-example"
type = "sudp"
localPort = 8085
secretKey = "example-secret"
[[proxies]]
name = "xtcp-example"
type = "xtcp"
localPort = 8086
secretKey = "example-secret"
[[visitors]]
name = "stcp-visitor"
type = "stcp"
serverName = "stcp-example"
serverUser = "example-user"
secretKey = "example-secret"
bindAddr = "127.0.0.1"
bindPort = 10001
[[visitors]]
name = "sudp-visitor"
type = "sudp"
serverName = "sudp-example"
bindPort = 10002
[[visitors]]
name = "xtcp-visitor"
type = "xtcp"
serverName = "xtcp-example"
secretKey = "example-secret"
bindAddr = "127.0.0.1"
bindPort = 10003
keepTunnelOpen = true
fallbackTo = "stcp-visitor"
fallbackTimeoutMs = 750
"#;
        let current = current_server();
        let (server, proxies) = parse_toml_config(input, &current, None).unwrap();
        assert!(server.multiuser);
        assert_eq!(server.auth.token, "example-token");
        assert_eq!(proxies.len(), 11);
        assert_eq!(proxies[0].local_port, "8081");
        assert_eq!(proxies[0].remote_port, "9001");
        assert!(proxies[2].basic_auth);
        assert!(proxies[3].https2http);
        assert_eq!(proxies[3].https2http_ca_file, "/example/plugin.pem");
        assert_eq!(proxies[3].https2http_key_file, "/example/plugin.key");
        assert_eq!(proxies[3].local_port, "8082");
        assert!(proxies[4].tls2raw);
        assert_eq!(proxies[4].tls2raw_ca_file, "/example/tls.pem");
        assert_eq!(proxies[4].tls2raw_key_file, "/example/tls.key");
        for proxy in &proxies {
            assert!(proxy.id.is_empty());
            assert_eq!(proxy.server_id, current.id);
            assert_eq!(proxy.status, 1);
        }
        for proxy in &proxies[5..8] {
            assert_eq!(proxy.visitors_model, "visitorsProvider");
            assert!(!ConfigGenerator::is_visitor(proxy));
        }
        for proxy in &proxies[8..] {
            assert_eq!(proxy.visitors_model, "visitors");
            assert!(ConfigGenerator::is_visitor(proxy));
        }
        assert!(proxies[10].keep_tunnel_open);
        assert_eq!(proxies[10].fallback_timeout_ms, 750);
        let generated =
            ConfigGenerator::gen_toml_config(&server, &proxies, Path::new("/example/frpc.log"));
        let (imported, imported_proxies) = parse_toml_config(&generated, &current, None).unwrap();
        let regenerated = ConfigGenerator::gen_toml_config(
            &imported,
            &imported_proxies,
            Path::new("/example/frpc.log"),
        );
        assert_eq!(
            toml::from_str::<Table>(&generated).unwrap(),
            toml::from_str::<Table>(&regenerated).unwrap()
        );
        assert_eq!(
            serde_json::to_value(&server).unwrap(),
            serde_json::to_value(&imported).unwrap()
        );
        assert_eq!(
            serde_json::to_value(&proxies).unwrap(),
            serde_json::to_value(&imported_proxies).unwrap()
        );
    }

    #[test]
    fn plugins_support_ipv6_and_https_tls2raw() {
        let input = r#"
serverAddr = "example.test"
[[proxies]]
name = "example"
type = "https"
customDomains = ["example.test"]
[proxies.plugin]
type = "tls2raw"
localAddr = "[::1]:443"
crtPath = "/example/cert.pem"
keyPath = "/example/key.pem"
"#;
        let (_, proxies) = parse_toml_config(input, &current_server(), None).unwrap();
        assert!(proxies[0].tls2raw);
        assert!(!proxies[0].https2http);
        assert_eq!(proxies[0].local_ip, "::1");
        assert_eq!(proxies[0].local_port, "443");
    }

    #[test]
    fn relative_certificate_paths_resolve_against_the_imported_file() {
        let base = Path::new(if cfg!(windows) {
            r"C:\imports\site"
        } else {
            "/imports/site"
        });
        let absolute = Path::new(if cfg!(windows) {
            r"C:\opt\frpc\client.key"
        } else {
            "/opt/frpc/client.key"
        });
        let input = format!(
            r#"
serverAddr = "example.test"
[transport.tls]
certFile = "certs/client.pem"
keyFile = '{absolute}'
trustedCaFile = "./ca.pem"
[[proxies]]
name = "https-example"
type = "https"
customDomains = ["example.test"]
[proxies.plugin]
type = "https2http"
localAddr = "127.0.0.1:8082"
crtPath = "../certs/plugin.pem"
keyPath = "plugin.key"
"#,
            absolute = absolute.display()
        );
        let (server, proxies) = parse_toml_config(&input, &current_server(), Some(base)).unwrap();
        assert_eq!(
            Path::new(&server.transport.tls.cert_file),
            base.join("certs/client.pem")
        );
        assert_eq!(Path::new(&server.transport.tls.key_file), absolute);
        assert_eq!(
            Path::new(&server.transport.tls.trusted_ca_file),
            base.join("ca.pem")
        );
        assert_eq!(
            Path::new(&proxies[0].https2http_ca_file),
            base.join("../certs/plugin.pem")
        );
        assert_eq!(
            Path::new(&proxies[0].https2http_key_file),
            base.join("plugin.key")
        );

        // Without a known source location the path is kept as written.
        let (server, proxies) = parse_toml_config(&input, &current_server(), None).unwrap();
        assert_eq!(server.transport.tls.cert_file, "certs/client.pem");
        assert_eq!(proxies[0].https2http_key_file, "plugin.key");
    }

    #[test]
    fn default_tcp_dynamic_remote_port_and_visitor_listener() {
        let input = r#"
serverAddr = "example.test"
[[proxies]]
name = "example"
localPort = 1
remotePort = 0
[[visitors]]
name = "fallback"
type = "stcp"
serverName = "example-provider"
bindPort = 8080
"#;
        let (_, proxies) = parse_toml_config(input, &current_server(), None).unwrap();
        assert_eq!(proxies[0].proxy_type, "tcp");
        assert_eq!(proxies[0].remote_port, "0");
        assert_eq!(proxies[1].bind_port, Some(8080));
    }

    #[test]
    fn rejects_empty_non_frpc_malformed_and_desktop_fields() {
        for input in [
            "",
            "# only a comment",
            "title = 'unrelated'",
            "[common]\nserver_addr = 'example.test'",
            "serverAddr = ''",
            "serverAddr = 'example.test'\n_id = 'other'",
            "serverAddr = 'example.test'\nfrpcVersion = 99",
            "serverAddr = 'example.test'\n[system]\nlanguage = 'en-US'",
            "serverAddr = 'example.test'\nserverPort = [",
            "serverAddr = 'example.test'\nserverAddr = 'duplicate'",
        ] {
            assert!(
                parse_toml_config(input, &current_server(), None).is_err(),
                "unexpected acceptance"
            );
        }
    }

    #[test]
    fn rejects_wrong_types_and_ranges_with_field_paths() {
        for (fragment, path) in [
            ("serverPort = '7000'", "serverPort"),
            ("serverPort = 0", "serverPort"),
            ("serverPort = 65536", "serverPort"),
            ("serverPort = 7000.0", "serverPort"),
            ("loginFailExit = 'false'", "loginFailExit"),
            ("udpPacketSize = -1", "udpPacketSize"),
            ("transport = false", "transport"),
            ("[transport]\ntcpMux = 1", "transport.tcpMux"),
            ("[transport]\nprotocol = 'invalid'", "transport.protocol"),
            ("[transport]\nheartbeatInterval = -1", "transport.heartbeatInterval"),
            ("[transport]\nheartbeatTimeout = 0", "transport.heartbeatTimeout"),
            ("[transport.tls]\nenable = 'true'", "transport.tls.enable"),
            ("[webServer]\nport = 65536", "webServer.port"),
            ("[log]\nmaxDays = -1", "log.maxDays"),
            ("proxies = {}", "proxies"),
            ("visitors = [false]", "visitors[0]"),
            ("[[proxies]]\nname = 'example'\ntype = 'tcp'\nlocalPort = '80'", "proxies[0].localPort"),
            ("[[proxies]]\nname = 'example'\nlocalPort = 65536", "proxies[0].localPort"),
            ("[[proxies]]\nname = 'example'\nlocalPort = 0", "proxies[0].localPort"),
            ("[[proxies]]\nname = 'example'\nlocalPort = 80\nremotePort = -1", "proxies[0].remotePort"),
            ("[[proxies]]\nname = 'example'\ntype = 'http'\nlocalPort = 80\ncustomDomains = [1]", "proxies[0].customDomains"),
            ("[[visitors]]\nname = 'example'\ntype = 'stcp'\nserverName = 'provider'\nbindPort = 0", "visitors[0].bindPort"),
            ("[[visitors]]\nname = 'example'\ntype = 'stcp'\nserverName = 'provider'\nbindPort = -1", "visitors[0].bindPort"),
            ("[[visitors]]\nname = 'example'\ntype = 'stcp'\nserverName = 'provider'", "visitors[0].bindPort"),
        ] {
            let input = format!("serverAddr = 'example.test'\n{fragment}");
            let error = parse_toml_config(&input, &current_server(), None).unwrap_err().to_string();
            assert!(error.contains(path), "missing {path} in {error}");
        }
    }

    #[test]
    fn rejects_unsupported_fields_plugins_and_invalid_names() {
        for fragment in [
            "[[proxies]]\nname = ''\nlocalPort = 80",
            "[[proxies]]\nname = ' padded '\nlocalPort = 80",
            "[[proxies]]\nname = \"bad\\nname\"\nlocalPort = 80",
            "[[proxies]]\nname = 'example'\ntype = 'unsupported'\nlocalPort = 80",
            "[[visitors]]\nname = 'example'\ntype = 'tcp'\nserverName = 'provider'",
            "[[visitors]]\nname = 'example'\ntype = 'stcp'\nserverName = ''",
            "[[proxies]]\nname = 'duplicate'\nlocalPort = 80\n[[proxies]]\nname = 'duplicate'\nlocalPort = 81",
            "[[proxies]]\nname = 'example'\nlocalPort = 80\n[proxies.transport]\nbandwidthLimit = '1MB'",
            "includes = ['example.toml']",
            "[metadatas]\nexample = 1",
            "[[proxies]]\nname = 'example'\n[proxies.plugin]\ntype = 'http_proxy'\nlocalAddr = '127.0.0.1:80'",
            "[[proxies]]\nname = 'example'\ntype = 'udp'\n[proxies.plugin]\ntype = 'tls2raw'\nlocalAddr = '127.0.0.1:80'",
            "[[proxies]]\nname = 'example'\ntype = 'tcp'\n[proxies.plugin]\ntype = 'https2http'\nlocalAddr = '127.0.0.1:80'",
            "[[proxies]]\nname = 'example'\ntype = 'https'\n[proxies.plugin]\ntype = 'https2http'\nlocalAddr = '127.0.0.1:80'\nunsupported = true",
            "[[proxies]]\nname = 'example'\ntype = 'tcp'\nlocalPort = 81\n[proxies.plugin]\ntype = 'tls2raw'\nlocalAddr = '127.0.0.1:80'",
            "[[proxies]]\nname = 'example'\ntype = 'tcp'\nlocalIP = '127.0.0.2'\nlocalPort = 80\n[proxies.plugin]\ntype = 'tls2raw'\nlocalAddr = '127.0.0.1:80'",
        ] {
            assert!(parse_toml_config(&format!("serverAddr = 'example.test'\n{fragment}"), &current_server(), None).is_err(), "unexpected acceptance");
        }
        for address in [
            "missing-port",
            "host:0",
            "host:65536",
            "host:abc",
            "host:-1",
            ":80",
            "http://host:80",
            "[broken:80",
        ] {
            assert!(parse_local_addr(address, "proxies[0].plugin.localAddr").is_err());
        }
    }

    #[test]
    fn errors_never_include_input_values_unknown_keys_or_parser_source() {
        let marker = "private-config-value";
        for input in [
            format!("serverAddr = '{marker}'\n[auth]\ntoken = \"{marker}\"\ninvalid = ["),
            format!(
                "serverAddr = '{marker}'\n[auth]\nmethod = 'oidc'\n[auth.oidc]\nclientID = 'id'\nclientSecret = \"{marker}\"\ntokenEndpointURL = 'https://example.test/token'\nunknown = '{marker}'"
            ),
            format!("serverAddr = '{marker}'\nserverPort = '{marker}'"),
            format!("serverAddr = '{marker}'\n'{marker}' = true"),
            format!("serverAddr = '{marker}'\n[[proxies]]\nname = '{marker}'\ntype = '{marker}'"),
            format!("serverAddr = '{marker}'\n[[proxies]]\nname = '{marker}'\nlocalPort = 80\n[proxies.plugin]\ntype = '{marker}'"),
        ] {
            let error = parse_toml_config(&input, &current_server(), None).unwrap_err();
            for message in [error.to_string(), format!("{error:?}"), format!("{error:#}")] {
                assert!(!message.contains(marker));
                assert!(!message.contains("serverAddr ="));
            }
        }
    }
    fn oidc_server() -> OpenSourceFrpcDesktopServer {
        let mut server = current_server();
        server.server_addr = "us.afrp.net".to_string();
        server.server_port = 7000;
        server.multiuser = true;
        server.user = "注册用户名".to_string();
        server.log.level = "info".to_string();
        server.transport.protocol = "tcp".to_string();
        server.auth = AuthConfig {
            method: "oidc".to_string(),
            token: String::new(),
            oidc: crate::models::OidcConfig {
                client_id: "注册用户名".to_string(),
                client_secret: "example-client-secret".to_string(),
                token_endpoint_url: "https://www.afrp.net/oidc/token.php".to_string(),
                audience: "afrp.net".to_string(),
                scope: "afrp".to_string(),
                additional_endpoint_params: HashMap::from([(
                    "client_type".to_string(),
                    "frpc-desktop".to_string(),
                )]),
            },
        };
        server
    }

    #[test]
    fn oidc_generation_and_import_roundtrip_the_documented_keys() {
        let server = oidc_server();
        let generated =
            ConfigGenerator::gen_toml_config(&server, &[], Path::new("/example/frpc.log"));
        let parsed: toml::Value = toml::from_str(&generated).unwrap();
        let oidc = parsed["auth"]["oidc"].as_table().unwrap();
        assert_eq!(parsed["auth"]["method"].as_str(), Some("oidc"));
        assert_eq!(oidc["clientID"].as_str(), Some("注册用户名"));
        assert_eq!(oidc["clientSecret"].as_str(), Some("example-client-secret"));
        assert_eq!(
            oidc["tokenEndpointURL"].as_str(),
            Some("https://www.afrp.net/oidc/token.php")
        );
        assert_eq!(oidc["audience"].as_str(), Some("afrp.net"));
        assert_eq!(oidc["scope"].as_str(), Some("afrp"));
        assert_eq!(
            oidc["additionalEndpointParams"]["client_type"].as_str(),
            Some("frpc-desktop")
        );

        let (imported, _) = parse_toml_config(&generated, &current_server(), None).unwrap();
        assert_eq!(imported.auth.method, "oidc");
        assert_eq!(imported.auth.oidc.client_id, "注册用户名");
        assert_eq!(imported.auth.oidc.client_secret, "example-client-secret");
        assert_eq!(
            imported.auth.oidc.token_endpoint_url,
            "https://www.afrp.net/oidc/token.php"
        );
        assert_eq!(imported.auth.oidc.audience, "afrp.net");
        assert_eq!(imported.auth.oidc.scope, "afrp");
        assert_eq!(
            imported.auth.oidc.additional_endpoint_params["client_type"],
            "frpc-desktop"
        );
    }

    #[test]
    fn imports_the_afrp_dotted_document_example() {
        let input = r#"serverAddr = "us.afrp.net"
serverPort = 7000
user = "注册用户名"

auth.method = "oidc"
auth.oidc.clientID = "注册用户名"
auth.oidc.clientSecret = "secret-value"
auth.oidc.tokenEndpointURL = "https://www.afrp.net/oidc/token.php"
auth.oidc.audience = "afrp.net"
auth.oidc.scope = "afrp"
auth.oidc.additionalEndpointParams.client_type = "frpc-desktop"
metadatas = { client_type = "frpc-desktop" }"#;
        let (server, _) = parse_toml_config(input, &current_server(), None).unwrap();
        assert_eq!(server.server_addr, "us.afrp.net");
        assert_eq!(server.server_port, 7000);
        assert_eq!(server.user, "注册用户名");
        assert_eq!(server.auth.method, "oidc");
        assert_eq!(server.auth.oidc.client_id, "注册用户名");
        assert_eq!(server.auth.oidc.client_secret, "secret-value");
        assert_eq!(
            server.auth.oidc.token_endpoint_url,
            "https://www.afrp.net/oidc/token.php"
        );
        assert_eq!(server.auth.oidc.audience, "afrp.net");
        assert_eq!(server.auth.oidc.scope, "afrp");
        assert_eq!(
            server.auth.oidc.additional_endpoint_params["client_type"],
            "frpc-desktop"
        );
        assert_eq!(server.metadatas["client_type"], "frpc-desktop");
    }

    #[test]
    fn oidc_import_requires_the_client_fields_and_an_http_url() {
        for input in [
            r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientSecret = "s"
tokenEndpointURL = "https://example.test/token""#,
            r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientID = "id"
tokenEndpointURL = "https://example.test/token""#,
            r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientID = "id"
clientSecret = "s""#,
            r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientID = "id"
clientSecret = "s"
tokenEndpointURL = "ftp://example.test/token""#,
            r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientID = "id"
clientSecret = "s"
tokenEndpointURL = "example.test/token""#,
        ] {
            let error = parse_toml_config(input, &current_server(), None)
                .unwrap_err()
                .to_string();
            assert!(
                error.contains("auth.oidc"),
                "unexpected error for missing or invalid field: {error}"
            );
        }
    }

    #[test]
    fn oidc_import_rejects_an_unsupported_auth_method() {
        let input = "serverAddr = 'example.test'\n[auth]\nmethod = 'jwt'";
        let error = parse_toml_config(input, &current_server(), None).unwrap_err();
        assert_eq!(error.to_string(), "Unsupported field value at auth.method");
    }

    #[test]
    fn oidc_and_every_other_string_are_toml_escaped() {
        let mut server = oidc_server();
        server.server_addr = "frps.ex\"ample.test".to_string();
        server.web_server.password = "quote\" slash\\ tab\t newline\n".to_string();
        server.auth.oidc.client_secret = "secret\"with\\backslash\tand\nnewline".to_string();
        let mut proxy = FrpcProxy {
            name: "na\"me\\with\tcontrols".to_string(),
            proxy_type: "tcp".to_string(),
            local_ip: "127.0.0.1".to_string(),
            local_port: serde_json::json!(80),
            remote_port: serde_json::json!(6080),
            status: 1,
            ..Default::default()
        };
        proxy.http_password = String::new();
        let generated =
            ConfigGenerator::gen_toml_config(&server, &[proxy], Path::new("/example/frpc.log"));
        let parsed: toml::Value = toml::from_str(&generated).unwrap();
        assert_eq!(parsed["serverAddr"].as_str(), Some("frps.ex\"ample.test"));
        assert_eq!(
            parsed["webServer"]["password"].as_str(),
            Some("quote\" slash\\ tab\t newline\n")
        );
        assert_eq!(
            parsed["auth"]["oidc"]["clientSecret"].as_str(),
            Some("secret\"with\\backslash\tand\nnewline")
        );
        assert_eq!(
            parsed["proxies"][0]["name"].as_str(),
            Some("na\"me\\with\tcontrols")
        );
        // Escaped values stay on their own line; a raw newline would split the
        // assignment and make the document invalid.
        assert_eq!(
            generated
                .lines()
                .filter(|line| line.starts_with("clientSecret = "))
                .count(),
            1
        );
    }

    #[test]
    fn stored_auth_json_is_backward_compatible_and_uses_frpc_key_names() {
        // Records written before this change have no `oidc` key at all.
        let old: AuthConfig =
            serde_json::from_str(r#"{"method":"token","token":"existing"}"#).unwrap();
        assert_eq!(old.method, "token");
        assert_eq!(old.oidc.client_id, "");
        assert!(old.oidc.additional_endpoint_params.is_empty());

        let stored = serde_json::to_value(oidc_server().auth).unwrap();
        // The stored blob (and therefore the DB row) keeps the secret; only the
        // share link and the non-config IPC surfaces scrub it.
        assert_eq!(stored["oidc"]["clientSecret"], "example-client-secret");
        assert_eq!(stored["oidc"]["clientID"], "注册用户名");
        assert_eq!(
            stored["oidc"]["tokenEndpointURL"],
            "https://www.afrp.net/oidc/token.php"
        );
        assert_eq!(
            stored["oidc"]["additionalEndpointParams"]["client_type"],
            "frpc-desktop"
        );
        let restored: AuthConfig = serde_json::from_value(stored).unwrap();
        assert_eq!(restored.oidc.client_secret, "example-client-secret");
        assert_eq!(restored.oidc.scope, "afrp");
    }

    #[test]
    fn plugin_local_addresses_escape_host_and_port() {
        let mut server = current_server();
        server.log.level = "info".to_string();
        server.transport.protocol = "tcp".to_string();
        let host = "127.0.0.1\"quoted\\host\ttab";
        let port = 8080;
        let expected = format!("{host}:{port}");
        let proxies = vec![
            FrpcProxy {
                name: "tls-tcp".to_string(),
                proxy_type: "tcp".to_string(),
                local_ip: host.to_string(),
                local_port: serde_json::json!(port),
                tls2raw: true,
                status: 1,
                ..Default::default()
            },
            FrpcProxy {
                name: "tls-https".to_string(),
                proxy_type: "https".to_string(),
                local_ip: host.to_string(),
                local_port: serde_json::json!(port),
                tls2raw: true,
                status: 1,
                ..Default::default()
            },
            FrpcProxy {
                name: "https2http".to_string(),
                proxy_type: "https".to_string(),
                local_ip: host.to_string(),
                local_port: serde_json::json!(port),
                https2http: true,
                status: 1,
                ..Default::default()
            },
        ];
        let generated =
            ConfigGenerator::gen_toml_config(&server, &proxies, Path::new("/example/frpc.log"));
        let parsed: toml::Value = toml::from_str(&generated).unwrap();
        let rendered: Vec<&str> = parsed["proxies"]
            .as_array()
            .unwrap()
            .iter()
            .map(|proxy| proxy["plugin"]["localAddr"].as_str().unwrap())
            .collect();
        assert_eq!(rendered, vec![expected.as_str(); 3]);
        assert_eq!(generated.matches("localAddr = ").count(), 3);
    }

    #[test]
    fn explicit_empty_additional_parameter_values_survive() {
        let input = r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientID = "id"
clientSecret = "s"
tokenEndpointURL = "https://example.test/token"
[auth.oidc.additionalEndpointParams]
client_type = ""
flag = "1""#;
        let (server, _) = parse_toml_config(input, &current_server(), None).unwrap();
        assert_eq!(
            server.auth.oidc.additional_endpoint_params["client_type"],
            ""
        );
        assert_eq!(server.auth.oidc.additional_endpoint_params.len(), 2);

        let generated =
            ConfigGenerator::gen_toml_config(&server, &[], Path::new("/example/frpc.log"));
        assert!(generated.contains("client_type = \"\""));
        assert!(generated.contains("flag = \"1\""));
        let (reimported, _) = parse_toml_config(&generated, &current_server(), None).unwrap();
        assert_eq!(
            reimported.auth.oidc.additional_endpoint_params["client_type"],
            ""
        );
        assert_eq!(reimported.auth.oidc.additional_endpoint_params["flag"], "1");
    }

    #[test]
    fn empty_additional_parameter_key_is_rejected() {
        let input = r#"serverAddr = "example.test"
[auth]
method = "oidc"
[auth.oidc]
clientID = "id"
clientSecret = "s"
tokenEndpointURL = "https://example.test/token"
[auth.oidc.additionalEndpointParams]
"" = "value-should-not-leak""#;
        let error = parse_toml_config(input, &current_server(), None)
            .unwrap_err()
            .to_string();
        assert!(error.contains("auth.oidc.additionalEndpointParams"));
        assert!(!error.contains("value-should-not-leak"));
    }

    #[test]
    fn empty_oidc_fields_are_not_emitted() {
        let mut server = oidc_server();
        server.auth.oidc.audience = String::new();
        server.auth.oidc.scope = String::new();
        server.auth.oidc.additional_endpoint_params.clear();
        let generated =
            ConfigGenerator::gen_toml_config(&server, &[], Path::new("/example/frpc.log"));
        assert!(!generated.contains("audience"));
        assert!(!generated.contains("scope"));
        assert!(!generated.contains("additionalEndpointParams"));
        assert!(generated.contains("clientID"));
        assert!(generated.contains("tokenEndpointURL"));
    }

    #[test]
    fn token_and_none_generation_is_byte_for_byte_unchanged() {
        let mut token_server = current_server();
        token_server.server_addr = "frps.example.test".to_string();
        token_server.server_port = 7000;
        token_server.login_fail_exit = true;
        token_server.multiuser = true;
        token_server.user = "alice".to_string();
        token_server.udp_packet_size = 1400;
        token_server.auth = AuthConfig {
            method: "token".to_string(),
            token: "token-value".to_string(),
            oidc: Default::default(),
        };
        token_server.log = LogConfig {
            to: String::new(),
            level: "warn".to_string(),
            max_days: 7,
            disable_print_color: true,
        };
        token_server.web_server = WebServerConfig {
            enable: true,
            addr: "127.0.0.1".to_string(),
            port: 7400,
            user: "admin".to_string(),
            password: "pass".to_string(),
            pprof_enable: true,
        };
        token_server.transport.dial_server_timeout = 12;
        token_server.transport.dial_server_keepalive = 7200;
        token_server.transport.pool_count = 2;
        token_server.transport.tcp_mux = true;
        token_server.transport.tcp_mux_keepalive_interval = 30;
        token_server.transport.heartbeat_interval = 30;
        token_server.transport.heartbeat_timeout = 90;
        token_server.transport.protocol = "websocket".to_string();
        token_server.transport.connect_server_local_ip = "127.0.0.1".to_string();
        token_server.transport.proxy_url = "socks5://127.0.0.1:1080".to_string();
        token_server.transport.tls = TransportTlsConfig {
            enable: true,
            cert_file: "/certs/client.crt".to_string(),
            key_file: "/certs/client.key".to_string(),
            trusted_ca_file: "/certs/ca.crt".to_string(),
            server_name: "frps.example.test".to_string(),
            disable_custom_tls_first_byte: true,
        };
        token_server.metadatas.insert(
            "id".to_string(),
            serde_json::Value::String("abc".to_string()),
        );
        let proxies = vec![
            FrpcProxy {
                name: "ssh".to_string(),
                proxy_type: "tcp".to_string(),
                local_ip: "127.0.0.1".to_string(),
                local_port: serde_json::json!(22),
                remote_port: serde_json::json!(6000),
                status: 1,
                ..Default::default()
            },
            FrpcProxy {
                name: "web".to_string(),
                proxy_type: "http".to_string(),
                local_ip: "127.0.0.1".to_string(),
                local_port: serde_json::json!(8080),
                custom_domains: vec!["a.example".to_string(), "b.example".to_string()],
                locations: vec!["/".to_string()],
                host_header_rewrite: "a.example".to_string(),
                basic_auth: true,
                http_user: "u".to_string(),
                http_password: "p".to_string(),
                status: 1,
                ..Default::default()
            },
        ];
        let token_generated =
            ConfigGenerator::gen_toml_config(&token_server, &proxies, Path::new("/logs/frpc.log"));
        assert_eq!(token_generated, TOKEN_SNAPSHOT);

        let mut none_server = token_server.clone();
        none_server.auth = AuthConfig {
            method: "none".to_string(),
            token: String::new(),
            oidc: Default::default(),
        };
        let none_generated =
            ConfigGenerator::gen_toml_config(&none_server, &proxies, Path::new("/logs/frpc.log"));
        assert_eq!(none_generated, NONE_SNAPSHOT);
    }

    const TOKEN_SNAPSHOT: &str = r#"serverAddr = "frps.example.test"
serverPort = 7000
loginFailExit = true
user = "alice"
udpPacketSize = 1400

[log]
to = "/logs/frpc.log"
level = "warn"
maxDays = 7
disablePrintColor = true

[auth]
method = "token"
token = "token-value"

[webServer]
addr = "127.0.0.1"
port = 7400
user = "admin"
password = "pass"
pprofEnable = true

[transport]
dialServerTimeout = 12
dialServerKeepalive = 7200
poolCount = 2
tcpMux = true
tcpMuxKeepaliveInterval = 30
protocol = "websocket"
connectServerLocalIP = "127.0.0.1"
proxyURL = "socks5://127.0.0.1:1080"
heartbeatInterval = 30
heartbeatTimeout = 90

[transport.tls]
enable = true
certFile = "/certs/client.crt"
keyFile = "/certs/client.key"
trustedCaFile = "/certs/ca.crt"
serverName = "frps.example.test"
disableCustomTLSFirstByte = true

[metadatas]
id = "abc"

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6000

[[proxies]]
name = "web"
type = "http"
localIP = "127.0.0.1"
localPort = 8080
customDomains = ["a.example", "b.example"]
locations = ["/"]
hostHeaderRewrite = "a.example"
httpUser = "u"
httpPassword = "p"
"#;
    const NONE_SNAPSHOT: &str = r#"serverAddr = "frps.example.test"
serverPort = 7000
loginFailExit = true
user = "alice"
udpPacketSize = 1400

[log]
to = "/logs/frpc.log"
level = "warn"
maxDays = 7
disablePrintColor = true

[webServer]
addr = "127.0.0.1"
port = 7400
user = "admin"
password = "pass"
pprofEnable = true

[transport]
dialServerTimeout = 12
dialServerKeepalive = 7200
poolCount = 2
tcpMux = true
tcpMuxKeepaliveInterval = 30
protocol = "websocket"
connectServerLocalIP = "127.0.0.1"
proxyURL = "socks5://127.0.0.1:1080"
heartbeatInterval = 30
heartbeatTimeout = 90

[transport.tls]
enable = true
certFile = "/certs/client.crt"
keyFile = "/certs/client.key"
trustedCaFile = "/certs/ca.crt"
serverName = "frps.example.test"
disableCustomTLSFirstByte = true

[metadatas]
id = "abc"

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6000

[[proxies]]
name = "web"
type = "http"
localIP = "127.0.0.1"
localPort = 8080
customDomains = ["a.example", "b.example"]
locations = ["/"]
hostHeaderRewrite = "a.example"
httpUser = "u"
httpPassword = "p"
"#;
}
