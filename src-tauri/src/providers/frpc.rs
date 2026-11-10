use super::{TunnelContext, TunnelProvider};
use crate::config_gen::ConfigGenerator;
use crate::db::proxy_repo::ProxyRepository;
use crate::db::server_repo::ServerRepository;
use crate::db::version_repo::VersionRepository;
use crate::downloader::VersionManager;
use crate::models::FrpcProxy;
use crate::process::{LaunchSpec, LogClassifier, LogSignal};
use crate::system::FrpcDetector;
use std::fs;
use std::path::PathBuf;

pub struct FrpcProvider;

impl FrpcProvider {
    /// Fails fast when a visitor's local listener is already taken, e.g. by
    /// another running tunnel, instead of letting frpc start half-working.
    fn check_visitor_ports(proxies: &[FrpcProxy]) -> Result<(), (String, String)> {
        for proxy in proxies {
            if !ConfigGenerator::is_enabled(proxy) || !ConfigGenerator::is_visitor(proxy) {
                continue;
            }
            let Some(port) = proxy.bind_port.filter(|p| *p > 0 && *p <= 65535) else {
                continue;
            };
            let host = if proxy.bind_addr.trim().is_empty() {
                "127.0.0.1"
            } else {
                proxy.bind_addr.trim()
            };
            let addr = format!("{}:{}", host, port);
            let in_use = if proxy.proxy_type == "sudp" {
                std::net::UdpSocket::bind(&addr).is_err()
            } else {
                std::net::TcpListener::bind(&addr).is_err()
            };
            if in_use {
                return Err((
                    "B1007".to_string(),
                    format!("Visitor Port In Use: {} ({})", port, proxy.name),
                ));
            }
        }
        Ok(())
    }

    fn classify(line: &str) -> LogSignal {
        let is_error = line.contains("connect to server error")
            || line.contains("login to server failed")
            || line.contains("address already in use")
            || line.contains("bind: address already in use")
            || line.contains("port already in use");
        let is_success = line.contains("login to server success")
            || line.contains("start proxy success")
            || line.contains("proxy added success")
            || line.contains("proxy added:");
        if is_error {
            LogSignal::Error
        } else if is_success {
            LogSignal::Connected
        } else {
            LogSignal::None
        }
    }
}

impl TunnelProvider for FrpcProvider {
    fn prepare(&self, ctx: &TunnelContext) -> Result<LaunchSpec, (String, String)> {
        let tunnel_id = ctx.tunnel.id.as_str();
        let (server, proxies) = {
            let conn = ctx.db.conn();
            let server = ServerRepository::get_server_config(&conn, tunnel_id)
                .map_err(|e| ("B1000".to_string(), e.to_string()))?;

            if server.server_addr.trim().is_empty() {
                return Err(("B1001".to_string(), "未配置服务端地址".to_string()));
            }

            if server.web_server.enable && server.web_server.port > 0 {
                let bind_addr = format!("127.0.0.1:{}", server.web_server.port);
                if std::net::TcpListener::bind(&bind_addr).is_err() {
                    return Err(("B1006".to_string(), "WebServer Port In Use".to_string()));
                }
            }

            let proxies = ProxyRepository::get_proxies_by_server(&conn, tunnel_id)
                .map_err(|e| ("B1000".to_string(), e.to_string()))?;
            (server, proxies)
        };

        Self::check_visitor_ports(&proxies)?;

        let binary = if !server.custom_frpc_path.trim().is_empty() {
            let resolved = FrpcDetector::resolve_path(&server.custom_frpc_path);
            if !resolved.exists() || !FrpcDetector::is_executable_binary(&resolved) {
                return Err((
                    "B1005".to_string(),
                    format!(
                        "指定的 frpc 二进制文件不存在或不可执行: {}",
                        resolved.display()
                    ),
                ));
            }
            resolved
        } else if let Some(release_id) = server.frpc_version {
            let conn = ctx.db.conn();
            let version = match VersionRepository::find_by_github_release_id(&conn, release_id) {
                Ok(Some(v)) => v,
                _ => {
                    return Err((
                        "B1005".to_string(),
                        "未找到版本（请在版本管理中重新下载）".to_string(),
                    ))
                }
            };
            let local_path = match version.local_path {
                Some(p) => PathBuf::from(p),
                None => {
                    return Err((
                        "B1005".to_string(),
                        "未找到版本（本地路径为空）".to_string(),
                    ))
                }
            };
            match VersionManager::resolve_frpc_binary(&local_path) {
                Some(bin) => bin,
                None => {
                    let _ = VersionRepository::delete_by_github_release_id(&conn, release_id);
                    return Err((
                        "B1005".to_string(),
                        "未找到版本（可执行文件不存在或已被杀毒软件清除，已清理无效记录，请重新下载或添加信任）".to_string(),
                    ));
                }
            }
        } else {
            let detected = FrpcDetector::detect();
            if detected.found {
                PathBuf::from(detected.path)
            } else {
                return Err((
                    "B1005".to_string(),
                    "未配置 frpc 路径或下载版本".to_string(),
                ));
            }
        };

        let toml_str = ConfigGenerator::gen_toml_config(&server, &proxies, ctx.log_path);
        if let Some(dir) = ctx.config_path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Some(dir) = ctx.log_path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Err(e) = fs::write(ctx.config_path, toml_str) {
            return Err(("B1000".to_string(), format!("写入配置文件失败: {}", e)));
        }

        Ok(LaunchSpec {
            binary,
            args: vec!["-c".into(), ctx.config_path.as_os_str().to_os_string()],
            envs: Vec::new(),
            log_path: ctx.log_path.to_path_buf(),
        })
    }

    fn log_classifier(&self) -> LogClassifier {
        Self::classify
    }
}
