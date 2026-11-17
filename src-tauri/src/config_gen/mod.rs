use crate::models::{FrpcProxy, OpenSourceFrpcDesktopServer};
use std::path::Path;

mod import;
pub use import::parse_toml_config;

/// Render a stored metadata value as the string frpc's `map[string]string`
/// expects. Strings pass through; other JSON scalars and containers are
/// preserved in their JSON text form rather than being discarded.
fn metadata_text(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(value) => value.clone(),
        serde_json::Value::Null => String::new(),
        other => other.to_string(),
    }
}

pub struct ConfigGenerator;

impl ConfigGenerator {
    fn is_range_port(proxy: &FrpcProxy) -> bool {
        let p_type = proxy.proxy_type.as_str();
        if p_type != "tcp" && p_type != "udp" {
            return false;
        }
        let local_port_str = match &proxy.local_port {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => String::new(),
        };
        local_port_str.contains('-') || local_port_str.contains(',')
    }

    pub fn is_visitor(proxy: &FrpcProxy) -> bool {
        let p_type = proxy.proxy_type.as_str();
        (p_type == "stcp" || p_type == "sudp" || p_type == "xtcp")
            && proxy.visitors_model == "visitors"
    }

    pub fn is_enabled(proxy: &FrpcProxy) -> bool {
        proxy.status == 1
    }

    pub fn gen_toml_config(
        server: &OpenSourceFrpcDesktopServer,
        proxies: &[FrpcProxy],
        frpc_log_path: &Path,
    ) -> String {
        let mut toml = String::new();

        // 1. Common Server Config
        toml.push_str(&format!("serverAddr = \"{}\"\n", server.server_addr));
        toml.push_str(&format!("serverPort = {}\n", server.server_port));
        toml.push_str(&format!("loginFailExit = {}\n", server.login_fail_exit));

        if server.multiuser && !server.user.is_empty() {
            toml.push_str(&format!("user = \"{}\"\n", server.user));
        }

        if server.udp_packet_size > 0 {
            toml.push_str(&format!("udpPacketSize = {}\n", server.udp_packet_size));
        }

        // Log config. The desktop owns the per-instance log file because the
        // log viewer and "open log file" read it, so a stale or imported
        // `log.to` must not redirect frpc's output elsewhere.
        toml.push_str("\n[log]\n");
        toml.push_str(&format!(
            "to = \"{}\"\n",
            frpc_log_path.to_string_lossy().replace('\\', "/")
        ));
        toml.push_str(&format!("level = \"{}\"\n", server.log.level));
        toml.push_str(&format!("maxDays = {}\n", server.log.max_days));
        toml.push_str(&format!(
            "disablePrintColor = {}\n",
            server.log.disable_print_color
        ));

        // Auth config
        if !server.auth.method.is_empty() && server.auth.method != "none" {
            toml.push_str("\n[auth]\n");
            toml.push_str(&format!("method = \"{}\"\n", server.auth.method));
            if !server.auth.token.is_empty() {
                toml.push_str(&format!("token = \"{}\"\n", server.auth.token));
            }
        }

        // WebServer config
        if server.web_server.enable && server.web_server.port > 0 {
            toml.push_str("\n[webServer]\n");
            toml.push_str(&format!("addr = \"{}\"\n", server.web_server.addr));
            toml.push_str(&format!("port = {}\n", server.web_server.port));
            if !server.web_server.user.is_empty() {
                toml.push_str(&format!("user = \"{}\"\n", server.web_server.user));
            }
            if !server.web_server.password.is_empty() {
                toml.push_str(&format!(
                    "password = \"{}\"\n",
                    server.web_server.password
                ));
            }
            toml.push_str(&format!(
                "pprofEnable = {}\n",
                server.web_server.pprof_enable
            ));
        }

        // Transport config
        toml.push_str("\n[transport]\n");
        toml.push_str(&format!(
            "dialServerTimeout = {}\n",
            server.transport.dial_server_timeout
        ));
        toml.push_str(&format!(
            "dialServerKeepalive = {}\n",
            server.transport.dial_server_keepalive
        ));
        toml.push_str(&format!("poolCount = {}\n", server.transport.pool_count));
        toml.push_str(&format!("tcpMux = {}\n", server.transport.tcp_mux));
        toml.push_str(&format!(
            "tcpMuxKeepaliveInterval = {}\n",
            server.transport.tcp_mux_keepalive_interval
        ));
        toml.push_str(&format!("protocol = \"{}\"\n", server.transport.protocol));
        if !server.transport.connect_server_local_ip.is_empty() {
            toml.push_str(&format!(
                "connectServerLocalIP = \"{}\"\n",
                server.transport.connect_server_local_ip
            ));
        }
        if !server.transport.proxy_url.is_empty() {
            toml.push_str(&format!(
                "proxyURL = \"{}\"\n",
                server.transport.proxy_url
            ));
        }
        if server.transport.heartbeat_interval > 0 {
            toml.push_str(&format!(
                "heartbeatInterval = {}\n",
                server.transport.heartbeat_interval
            ));
        }
        if server.transport.heartbeat_timeout > 0 {
            toml.push_str(&format!(
                "heartbeatTimeout = {}\n",
                server.transport.heartbeat_timeout
            ));
        }

        // Transport TLS
        toml.push_str("\n[transport.tls]\n");
        toml.push_str(&format!("enable = {}\n", server.transport.tls.enable));
        if !server.transport.tls.cert_file.is_empty() {
            toml.push_str(&format!(
                "certFile = \"{}\"\n",
                server.transport.tls.cert_file.replace('\\', "/")
            ));
        }
        if !server.transport.tls.key_file.is_empty() {
            toml.push_str(&format!(
                "keyFile = \"{}\"\n",
                server.transport.tls.key_file.replace('\\', "/")
            ));
        }
        if !server.transport.tls.trusted_ca_file.is_empty() {
            toml.push_str(&format!(
                "trustedCaFile = \"{}\"\n",
                server.transport.tls.trusted_ca_file.replace('\\', "/")
            ));
        }
        if !server.transport.tls.server_name.is_empty() {
            toml.push_str(&format!(
                "serverName = \"{}\"\n",
                server.transport.tls.server_name
            ));
        }
        toml.push_str(&format!(
            "disableCustomTLSFirstByte = {}\n",
            server.transport.tls.disable_custom_tls_first_byte
        ));

        // Custom metadata required by some frps plugins, such as an instance ID.
        // frpc expects a string map, so coerce stored non-string values to text
        // instead of dropping them. The empty default token is only a UI
        // placeholder unless multi-user mode explicitly uses it.
        let metadatas: toml::map::Map<String, toml::Value> = server
            .metadatas
            .iter()
            .filter(|(key, value)| {
                key.as_str() != "token" || server.multiuser || !metadata_text(value).is_empty()
            })
            .map(|(key, value)| (key.clone(), toml::Value::String(metadata_text(value))))
            .collect();
        if !metadatas.is_empty() {
            if let Ok(rendered) = toml::to_string(&metadatas) {
                toml.push_str("\n[metadatas]\n");
                toml.push_str(&rendered);
            }
        }

        // 2. Normal Proxies
        let mut range_proxies = Vec::new();
        for proxy in proxies {
            if !Self::is_enabled(proxy) || Self::is_visitor(proxy) {
                continue;
            }

            if Self::is_range_port(proxy) {
                let local_p = match &proxy.local_port {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    _ => "8080".to_string(),
                };
                let remote_p = match &proxy.remote_port {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    _ => "8080".to_string(),
                };
                let template = format!(
                    "\n{{{{- range $_, $v := parseNumberRangePair \"{}\" \"{}\" }}}}\n[[proxies]]\ntype = \"{}\"\nname = \"{}-{{{{ $v.First }}}}\"\nlocalIP = \"{}\"\nlocalPort = {{{{ $v.First }}}}\nremotePort = {{{{ $v.Second }}}}\n{{{{- end }}}}\n",
                    local_p, remote_p, proxy.proxy_type, proxy.name, proxy.local_ip
                );
                range_proxies.push(template);
                continue;
            }

            toml.push_str("\n[[proxies]]\n");
            toml.push_str(&format!("name = \"{}\"\n", proxy.name));
            toml.push_str(&format!("type = \"{}\"\n", proxy.proxy_type));

            let local_p = match &proxy.local_port {
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::String(s) => s.clone(),
                _ => "8080".to_string(),
            };
            let remote_p = match &proxy.remote_port {
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::String(s) => s.clone(),
                _ => "8080".to_string(),
            };

            match proxy.proxy_type.as_str() {
                "tcp" | "udp" => {
                    toml.push_str(&format!("localIP = \"{}\"\n", proxy.local_ip));
                    toml.push_str(&format!("localPort = {}\n", local_p));
                    toml.push_str(&format!("remotePort = {}\n", remote_p));

                    if proxy.proxy_type == "tcp" && proxy.tls2raw {
                        toml.push_str("\n[proxies.plugin]\n");
                        toml.push_str("type = \"tls2raw\"\n");
                        toml.push_str(&format!(
                            "localAddr = \"{}:{}\"\n",
                            proxy.local_ip, local_p
                        ));
                        toml.push_str(&format!(
                            "crtPath = \"{}\"\n",
                            proxy.tls2raw_ca_file.replace('\\', "/")
                        ));
                        toml.push_str(&format!(
                            "keyPath = \"{}\"\n",
                            proxy.tls2raw_key_file.replace('\\', "/")
                        ));
                    }
                }
                "http" | "https" => {
                    let has_plugin = proxy.proxy_type == "https"
                        && (proxy.https2http || proxy.tls2raw);
                    if !has_plugin {
                        toml.push_str(&format!("localIP = \"{}\"\n", proxy.local_ip));
                        toml.push_str(&format!("localPort = {}\n", local_p));
                    }

                    if !proxy.custom_domains.is_empty() {
                        let domains: Vec<String> = proxy
                            .custom_domains
                            .iter()
                            .filter(|d| !d.is_empty())
                            .map(|d| format!("\"{}\"", d))
                            .collect();
                        if !domains.is_empty() {
                            toml.push_str(&format!(
                                "customDomains = [{}]\n",
                                domains.join(", ")
                            ));
                        }
                    }

                    if !proxy.subdomain.is_empty() {
                        toml.push_str(&format!("subdomain = \"{}\"\n", proxy.subdomain));
                    }

                    let locations: Vec<String> = proxy
                        .locations
                        .iter()
                        .filter(|l| !l.is_empty())
                        .map(|l| format!("\"{}\"", l))
                        .collect();
                    if !locations.is_empty() {
                        toml.push_str(&format!(
                            "locations = [{}]\n",
                            locations.join(", ")
                        ));
                    }

                    if !proxy.host_header_rewrite.is_empty() {
                        toml.push_str(&format!(
                            "hostHeaderRewrite = \"{}\"\n",
                            proxy.host_header_rewrite
                        ));
                    }

                    if proxy.basic_auth {
                        toml.push_str(&format!("httpUser = \"{}\"\n", proxy.http_user));
                        toml.push_str(&format!(
                            "httpPassword = \"{}\"\n",
                            proxy.http_password
                        ));
                    }

                    if proxy.proxy_type == "https" {
                        if proxy.tls2raw {
                            toml.push_str("\n[proxies.plugin]\n");
                            toml.push_str("type = \"tls2raw\"\n");
                            toml.push_str(&format!(
                                "localAddr = \"{}:{}\"\n",
                                proxy.local_ip, local_p
                            ));
                            toml.push_str(&format!(
                                "crtPath = \"{}\"\n",
                                proxy.tls2raw_ca_file.replace('\\', "/")
                            ));
                            toml.push_str(&format!(
                                "keyPath = \"{}\"\n",
                                proxy.tls2raw_key_file.replace('\\', "/")
                            ));
                        } else if proxy.https2http {
                            toml.push_str("\n[proxies.plugin]\n");
                            toml.push_str("type = \"https2http\"\n");
                            toml.push_str(&format!(
                                "localAddr = \"{}:{}\"\n",
                                proxy.local_ip, local_p
                            ));
                            toml.push_str(&format!(
                                "crtPath = \"{}\"\n",
                                proxy.https2http_ca_file.replace('\\', "/")
                            ));
                            toml.push_str(&format!(
                                "keyPath = \"{}\"\n",
                                proxy.https2http_key_file.replace('\\', "/")
                            ));
                        }
                    }
                }
                "stcp" | "xtcp" | "sudp" => {
                    toml.push_str(&format!("localIP = \"{}\"\n", proxy.local_ip));
                    toml.push_str(&format!("localPort = {}\n", local_p));
                    toml.push_str(&format!("secretKey = \"{}\"\n", proxy.secret_key));
                }
                _ => {}
            }

            // Proxy transport
            if proxy.transport.use_encryption
                || proxy.transport.use_compression
                || !proxy.transport.proxy_protocol_version.is_empty()
            {
                toml.push_str("\n[proxies.transport]\n");
                toml.push_str(&format!(
                    "useEncryption = {}\n",
                    proxy.transport.use_encryption
                ));
                toml.push_str(&format!(
                    "useCompression = {}\n",
                    proxy.transport.use_compression
                ));
                if !proxy.transport.proxy_protocol_version.is_empty() {
                    toml.push_str(&format!(
                        "proxyProtocolVersion = \"{}\"\n",
                        proxy.transport.proxy_protocol_version
                    ));
                }
            }
        }

        // 3. Visitors
        for proxy in proxies {
            if !Self::is_enabled(proxy) || !Self::is_visitor(proxy) {
                continue;
            }

            toml.push_str("\n[[visitors]]\n");
            toml.push_str(&format!("name = \"{}\"\n", proxy.name));
            toml.push_str(&format!("type = \"{}\"\n", proxy.proxy_type));
            toml.push_str(&format!("serverName = \"{}\"\n", proxy.server_name));
            toml.push_str(&format!("secretKey = \"{}\"\n", proxy.secret_key));
            toml.push_str(&format!("bindAddr = \"{}\"\n", proxy.bind_addr));
            if let Some(port) = proxy.bind_port {
                toml.push_str(&format!("bindPort = {}\n", port));
            }
            if !proxy.server_user.is_empty() {
                toml.push_str(&format!("serverUser = \"{}\"\n", proxy.server_user));
            }

            if proxy.proxy_type == "xtcp" {
                toml.push_str(&format!(
                    "keepTunnelOpen = {}\n",
                    proxy.keep_tunnel_open
                ));
                if !proxy.fallback_to.is_empty() {
                    toml.push_str(&format!("fallbackTo = \"{}\"\n", proxy.fallback_to));
                    toml.push_str(&format!(
                        "fallbackTimeoutMs = {}\n",
                        proxy.fallback_timeout_ms
                    ));
                }
            }
        }

        // Range proxies templates appended
        for t in range_proxies {
            toml.push_str(&t);
        }

        toml
    }
}
