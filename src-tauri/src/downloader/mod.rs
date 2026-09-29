use crate::db::version_repo::VersionRepository;
use crate::models::{FrpcVersion, GithubRelease};
use flate2::read::GzDecoder;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

pub const EMBEDDED_RELEASES_JSON: &str = include_str!("../../json/frp-releases.json");
pub const EMBEDDED_CHECKSUMS_JSON: &str =
    include_str!("../../json/frp_all_sha256_checksums.json");

pub struct VersionManager {
    versions_storage_dir: PathBuf,
}

impl VersionManager {
    pub fn new<P: AsRef<Path>>(app_data_dir: P) -> Self {
        let versions_storage_dir = app_data_dir.as_ref().join("versions");
        let _ = fs::create_dir_all(&versions_storage_dir);
        Self {
            versions_storage_dir,
        }
    }

    pub fn get_arch_patterns() -> (&'static str, &'static str) {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        return ("darwin", "arm64");
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        return ("darwin", "amd64");
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        return ("windows", "amd64");
        #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
        return ("windows", "arm64");
        #[cfg(all(target_os = "windows", target_arch = "x86"))]
        return ("windows", "386");
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        return ("linux", "amd64");
        #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
        return ("linux", "arm64");

        #[allow(unreachable_code)]
        ("unknown", "unknown")
    }

    pub fn get_frpc_executable_name() -> &'static str {
        #[cfg(target_os = "windows")]
        return "frpc.exe";
        #[cfg(not(target_os = "windows"))]
        return "frpc";
    }

    pub fn get_all_catalog_versions(&self, conn: &Connection) -> Vec<FrpcVersion> {
        let (os_pattern, arch_pattern) = Self::get_arch_patterns();
        let releases: Vec<GithubRelease> =
            serde_json::from_str(EMBEDDED_RELEASES_JSON).unwrap_or_default();
        let downloaded =
            VersionRepository::get_downloaded_versions(conn).unwrap_or_default();
        let downloaded_map: HashMap<i64, FrpcVersion> =
            downloaded.into_iter().map(|v| (v.github_release_id, v)).collect();

        let mut result = Vec::new();
        for release in releases {
            if release.id <= 124395282 {
                continue;
            }

            let matching_asset = release.assets.iter().find(|a| {
                let name = a.name.to_lowercase();
                name.contains(os_pattern) && name.contains(arch_pattern)
            });

            if let Some(asset) = matching_asset {
                let release_id = release.id;
                let existing = downloaded_map.get(&release_id);
                let mut is_downloaded = false;
                let mut local_path = None;

                if let Some(db_ver) = existing {
                    if let Some(ref path_str) = db_ver.local_path {
                        let bin = Path::new(path_str).join(Self::get_frpc_executable_name());
                        if bin.exists() {
                            is_downloaded = true;
                            local_path = Some(path_str.clone());
                        } else {
                            // stale DB record
                            let _ = VersionRepository::delete_by_github_release_id(conn, release_id);
                        }
                    }
                }

                let total_downloads: i64 = release.assets.iter().map(|a| a.download_count).sum();
                let size_formatted = Self::format_bytes(asset.size);

                result.push(FrpcVersion {
                    id: existing.map(|e| e.id.clone()).unwrap_or_default(),
                    github_release_id: release.id,
                    github_asset_id: asset.id,
                    github_created_at: asset.created_at.clone(),
                    name: release.name.clone(),
                    asset_name: asset.name.clone(),
                    version_download_count: total_downloads,
                    asset_download_count: asset.download_count,
                    browser_download_url: asset.browser_download_url.clone(),
                    downloaded: is_downloaded,
                    local_path,
                    size: size_formatted,
                });
            }
        }
        result
    }

    pub async fn download_version(
        &self,
        db: &crate::db::DbManager,
        github_release_id: i64,
        mirror_id: Option<String>,
    ) -> anyhow::Result<FrpcVersion> {
        let version_info = {
            let conn = db.conn();
            let catalog = self.get_all_catalog_versions(&conn);
            catalog
                .into_iter()
                .find(|v| v.github_release_id == github_release_id)
                .ok_or_else(|| anyhow::anyhow!("Version not found"))?
        };

        let mut download_url = version_info.browser_download_url.clone();
        if let Some(ref mirror) = mirror_id {
            if mirror == "gh-jwinks" {
                download_url = format!("https://gh.jwinks.com/file/{}", download_url);
            }
        }

        let resp = reqwest::get(&download_url).await?;
        let bytes = resp.bytes().await?;

        // Extract to target directory
        let version_dir_name = format!("{:x}", md5::compute(version_info.name.as_bytes()));
        let dest_dir = self.versions_storage_dir.join(&version_dir_name);
        if dest_dir.exists() {
            let _ = fs::remove_dir_all(&dest_dir);
        }
        fs::create_dir_all(&dest_dir)?;

        Self::extract_archive(&bytes, &version_info.asset_name, &dest_dir)?;

        let local_path = dest_dir.to_str().unwrap_or("").to_string();
        let mut saved = version_info.clone();
        saved.downloaded = true;
        saved.local_path = Some(local_path);

        let final_version = {
            let conn = db.conn();
            VersionRepository::save_version(&conn, saved)?
        };
        Ok(final_version)
    }

    pub fn delete_version(&self, conn: &Connection, github_release_id: i64) -> anyhow::Result<()> {
        if let Ok(Some(version)) =
            VersionRepository::find_by_github_release_id(conn, github_release_id)
        {
            if let Some(ref path_str) = version.local_path {
                let path = Path::new(path_str);
                if path.exists() {
                    let _ = fs::remove_dir_all(path);
                }
            }
            VersionRepository::delete_by_github_release_id(conn, github_release_id)?;
        }
        Ok(())
    }

    pub fn import_local_file(
        &self,
        conn: &Connection,
        file_path: &Path,
    ) -> anyhow::Result<FrpcVersion> {
        let mut file = File::open(file_path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        let mut hasher = Sha256::new();
        hasher.update(&buffer);
        let hash = format!("{:x}", hasher.finalize());

        let checksums: HashMap<String, String> =
            serde_json::from_str(EMBEDDED_CHECKSUMS_JSON)?;
        let asset_name = checksums
            .get(&hash)
            .ok_or_else(|| anyhow::anyhow!("无法识别文件"))?;

        let (os_pattern, arch_pattern) = Self::get_arch_patterns();
        let lower = asset_name.to_lowercase();
        if !lower.contains(os_pattern) || !lower.contains(arch_pattern) {
            return Err(anyhow::anyhow!("所选 frp 架构与操作系统不符"));
        }

        let catalog = self.get_all_catalog_versions(conn);
        let version_info = catalog
            .into_iter()
            .find(|v| &v.asset_name == asset_name)
            .ok_or_else(|| anyhow::anyhow!("未找到匹配版本"))?;

        if version_info.downloaded {
            return Err(anyhow::anyhow!("导入失败，版本已存在"));
        }

        let version_dir_name = format!("{:x}", md5::compute(version_info.name.as_bytes()));
        let dest_dir = self.versions_storage_dir.join(&version_dir_name);
        if dest_dir.exists() {
            let _ = fs::remove_dir_all(&dest_dir);
        }
        fs::create_dir_all(&dest_dir)?;

        Self::extract_archive(&buffer, asset_name, &dest_dir)?;

        let mut saved = version_info.clone();
        saved.downloaded = true;
        saved.local_path = Some(dest_dir.to_str().unwrap_or("").to_string());

        let final_version = VersionRepository::save_version(conn, saved)?;
        Ok(final_version)
    }

    fn extract_archive(data: &[u8], asset_name: &str, dest_dir: &Path) -> anyhow::Result<()> {
        if asset_name.ends_with(".zip") {
            let reader = std::io::Cursor::new(data);
            let mut archive = zip::ZipArchive::new(reader)?;
            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                let file_name = match file.enclosed_name() {
                    Some(name) => name.to_path_buf(),
                    None => continue,
                };
                // Flatten: if file name is "frpc.exe" or "frpc", extract directly
                if let Some(name_str) = file_name.file_name() {
                    let name_str = name_str.to_str().unwrap_or("");
                    if name_str == "frpc" || name_str == "frpc.exe" {
                        let out_path = dest_dir.join(name_str);
                        let mut out = File::create(&out_path)?;
                        std::io::copy(&mut file, &mut out)?;
                        #[cfg(unix)]
                        {
                            use std::os::unix::fs::PermissionsExt;
                            let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(0o755));
                        }
                    }
                }
            }
        } else {
            // .tar.gz
            let gz = GzDecoder::new(data);
            let mut archive = tar::Archive::new(gz);
            for entry in archive.entries()? {
                let mut entry = entry?;
                let path = entry.path()?.to_path_buf();
                if let Some(file_name) = path.file_name() {
                    let name_str = file_name.to_str().unwrap_or("");
                    if name_str == "frpc" || name_str == "frpc.exe" {
                        let out_path = dest_dir.join(name_str);
                        let mut out = File::create(&out_path)?;
                        std::io::copy(&mut entry, &mut out)?;
                        #[cfg(unix)]
                        {
                            use std::os::unix::fs::PermissionsExt;
                            let _ = fs::set_permissions(&out_path, fs::Permissions::from_mode(0o755));
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn format_bytes(bytes: i64) -> String {
        if bytes < 1024 {
            format!("{} B", bytes)
        } else if bytes < 1024 * 1024 {
            format!("{:.2} KB", bytes as f64 / 1024.0)
        } else {
            format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
        }
    }
}
