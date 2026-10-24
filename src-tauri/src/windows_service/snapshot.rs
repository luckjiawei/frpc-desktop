use crate::config_gen::ConfigGenerator;
use crate::models::{FrpcProxy, OpenSourceFrpcDesktopServer};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub fn prepare_snapshot(
    server: &OpenSourceFrpcDesktopServer,
    proxies: &[FrpcProxy],
    binary: &Path,
    payload: &Path,
    destination: &Path,
    log_path: &Path,
) -> Result<(), String> {
    let binary = fs::canonicalize(binary).map_err(|_| "SERVICE_PAYLOAD_MISSING")?;
    if !binary.is_file() {
        return Err("SERVICE_PAYLOAD_MISSING".into());
    }
    let source_base = binary.parent().ok_or("SERVICE_PAYLOAD_MISSING")?;
    fs::create_dir_all(payload).map_err(|_| "SERVICE_OPERATION_FAILED")?;
    fs::copy(&binary, payload.join("frpc.exe")).map_err(|_| "SERVICE_PAYLOAD_MISSING")?;

    // Work on owned models, never rewrite certificate paths in the database.
    let mut server = server.clone();
    let mut proxies = proxies.to_vec();
    let mut assets = Assets {
        source_base,
        payload,
        destination,
        copied: HashMap::new(),
    };
    assets.copy(&mut server.transport.tls.cert_file)?;
    assets.copy(&mut server.transport.tls.key_file)?;
    assets.copy(&mut server.transport.tls.trusted_ca_file)?;
    for proxy in &mut proxies {
        if proxy.status != 1
            || proxy.visitors_model == "visitors"
                && matches!(proxy.proxy_type.as_str(), "stcp" | "sudp" | "xtcp")
        {
            continue;
        }
        if proxy.tls2raw && matches!(proxy.proxy_type.as_str(), "tcp" | "https") {
            assets.copy(&mut proxy.tls2raw_ca_file)?;
            assets.copy(&mut proxy.tls2raw_key_file)?;
        } else if proxy.proxy_type == "https" && proxy.https2http {
            assets.copy(&mut proxy.https2http_ca_file)?;
            assets.copy(&mut proxy.https2http_key_file)?;
        }
    }
    server.log.to = log_path.to_string_lossy().into_owned();
    let config = ConfigGenerator::gen_toml_config(&server, &proxies, log_path);
    fs::write(payload.join("frpc.toml"), config).map_err(|_| "SERVICE_OPERATION_FAILED".into())
}

struct Assets<'a> {
    source_base: &'a Path,
    payload: &'a Path,
    destination: &'a Path,
    copied: HashMap<PathBuf, PathBuf>,
}

impl Assets<'_> {
    fn copy(&mut self, reference: &mut String) -> Result<(), String> {
        if reference.is_empty() {
            return Ok(());
        }
        let source = fs::canonicalize(self.source_base.join(&*reference))
            .map_err(|_| "SERVICE_ASSET_UNREADABLE")?;
        if !source.is_file() {
            return Err("SERVICE_ASSET_UNREADABLE".into());
        }
        let relative = if let Some(existing) = self.copied.get(&source) {
            existing.clone()
        } else {
            let relative = PathBuf::from("assets").join(format!("asset-{}.pem", self.copied.len()));
            fs::create_dir_all(self.payload.join("assets"))
                .map_err(|_| "SERVICE_ASSET_UNREADABLE")?;
            fs::copy(&source, self.payload.join(&relative))
                .map_err(|_| "SERVICE_ASSET_UNREADABLE")?;
            self.copied.insert(source, relative.clone());
            relative
        };
        *reference = self
            .destination
            .join(relative)
            .to_string_lossy()
            .into_owned();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::server_repo::ServerRepository;

    #[test]
    fn snapshot_copies_relative_assets_and_preserves_saved_models() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("version");
        fs::create_dir(&source).unwrap();
        let binary = source.join("legacy-frpc.exe");
        fs::write(&binary, b"test-binary").unwrap();
        fs::write(source.join("certificate.pem"), b"test-certificate").unwrap();
        fs::write(source.join("key.pem"), b"test-key").unwrap();
        let mut server = ServerRepository::create_default_server();
        server.server_addr = "frps.example.com".into();
        server.auth.token = "example-token".into();
        server.transport.tls.cert_file = "certificate.pem".into();
        server.transport.tls.trusted_ca_file = "certificate.pem".into();
        server.transport.tls.key_file = "key.pem".into();
        server.log.to = "stdout".into();
        let proxy: FrpcProxy = serde_json::from_value(serde_json::json!({
            "type": "https", "name": "https", "tls2raw": true,
            "tls2rawCaFile": "certificate.pem", "tls2rawKeyFile": "key.pem",
            "localIP": "127.0.0.1", "localPort": 8080, "status": 1
        }))
        .unwrap();
        let payload = temp.path().join("stage");
        let destination = temp.path().join("deployment").join("generation");
        let log_path = temp.path().join("logs").join("frpc.log");
        prepare_snapshot(
            &server,
            &[proxy.clone()],
            &binary,
            &payload,
            &destination,
            &log_path,
        )
        .unwrap();
        assert_eq!(fs::read(payload.join("frpc.exe")).unwrap(), b"test-binary");
        assert_eq!(
            fs::read(payload.join("assets/asset-0.pem")).unwrap(),
            b"test-certificate"
        );
        assert_eq!(
            fs::read(payload.join("assets/asset-1.pem")).unwrap(),
            b"test-key"
        );
        assert_eq!(fs::read_dir(payload.join("assets")).unwrap().count(), 2);
        let config = fs::read_to_string(payload.join("frpc.toml")).unwrap();
        let parsed: toml::Value = toml::from_str(&config).unwrap();
        assert_eq!(
            parsed["log"]["to"].as_str().unwrap(),
            log_path.to_string_lossy().replace('\\', "/")
        );
        assert_eq!(
            parsed["transport"]["tls"]["certFile"],
            parsed["proxies"][0]["plugin"]["crtPath"]
        );
        assert_eq!(server.transport.tls.cert_file, "certificate.pem");
        assert_eq!(proxy.tls2raw_ca_file, "certificate.pem");
        assert_eq!(server.auth.token, "example-token");
        assert_eq!(server.log.to, "stdout");
        assert_eq!(
            fs::read(source.join("certificate.pem")).unwrap(),
            b"test-certificate"
        );
    }

    #[test]
    fn missing_active_assets_fail_but_unused_proxy_assets_are_ignored() {
        let temp = tempfile::tempdir().unwrap();
        let binary = temp.path().join("frpc.exe");
        fs::write(&binary, b"test-binary").unwrap();
        let mut server = ServerRepository::create_default_server();
        let payload = temp.path().join("payload");
        let destination = temp.path().join("destination");
        let log = temp.path().join("frpc.log");
        let disabled: FrpcProxy = serde_json::from_value(serde_json::json!({
            "type": "https", "tls2raw": true, "tls2rawCaFile": "missing.pem", "status": 0
        }))
        .unwrap();
        prepare_snapshot(&server, &[disabled], &binary, &payload, &destination, &log).unwrap();
        assert!(!payload.join("assets").exists());
        server.transport.tls.cert_file = "missing.pem".into();
        assert_eq!(
            prepare_snapshot(&server, &[], &binary, &payload, &destination, &log),
            Err("SERVICE_ASSET_UNREADABLE".into())
        );
    }
}
