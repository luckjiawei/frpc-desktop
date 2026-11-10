use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectFrpcResult {
    pub found: bool,
    pub path: String,
    pub version: Option<String>,
    pub source: String, // "local_bin", "shell", "well_known", "none"
}

pub struct FrpcDetector;

impl FrpcDetector {
    /// Expand `~` or `~/...` to the user's home directory.
    pub fn resolve_path(raw: &str) -> PathBuf {
        let trimmed = raw.trim();
        if trimmed == "~" {
            dirs::home_dir().unwrap_or_else(|| PathBuf::from("~"))
        } else if let Some(stripped) = trimmed.strip_prefix("~/") {
            if let Some(home) = dirs::home_dir() {
                home.join(stripped)
            } else {
                PathBuf::from(trimmed)
            }
        } else if let Some(stripped) = trimmed.strip_prefix("~\\") {
            if let Some(home) = dirs::home_dir() {
                home.join(stripped)
            } else {
                PathBuf::from(trimmed)
            }
        } else {
            PathBuf::from(trimmed)
        }
    }

    /// Check if path is a file and executable.
    pub fn is_executable_binary(path: &Path) -> bool {
        if !path.is_file() {
            return false;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(path) {
                return meta.permissions().mode() & 0o111 != 0;
            }
            false
        }
        #[cfg(windows)]
        {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                ext.eq_ignore_ascii_case("exe")
                    || ext.eq_ignore_ascii_case("bat")
                    || ext.eq_ignore_ascii_case("cmd")
            } else {
                false
            }
        }
    }

    /// Run `<path> -v` to get frpc version string.
    pub fn get_frpc_version(path: &Path) -> Option<String> {
        Self::get_version(path, "-v")
    }

    /// Run `<path> --version`, e.g. "cloudflared version 2025.1.0 (built ...)".
    pub fn get_cloudflared_version(path: &Path) -> Option<String> {
        Self::get_version(path, "--version")
    }

    fn get_version(path: &Path, arg: &str) -> Option<String> {
        let output = std::process::Command::new(path).arg(arg).output().ok()?;

        if output.status.success() {
            let ver = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !ver.is_empty() {
                return Some(ver);
            }
            let err_ver = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if !err_ver.is_empty() {
                return Some(err_ver);
            }
        }
        None
    }

    /// Auto-detect frpc path:
    /// Priority 1: ~/.local/bin/frpc*
    /// Priority 2: shell `which frpc` / `where frpc`
    /// Priority 3: well-known directories (/opt/homebrew/bin/frpc, /usr/local/bin/frpc, etc.)
    pub fn detect() -> DetectFrpcResult {
        Self::detect_binary(
            "frpc",
            &[
                "/opt/homebrew/bin/frpc",
                "/usr/local/bin/frpc",
                "/usr/bin/frpc",
                "/bin/frpc",
            ],
            Self::get_frpc_version,
        )
    }

    /// Auto-detect cloudflared with the same priorities as [`Self::detect`];
    /// also checks the default location of the Windows MSI installer.
    pub fn detect_cloudflared() -> DetectFrpcResult {
        Self::detect_binary(
            "cloudflared",
            &[
                "/opt/homebrew/bin/cloudflared",
                "/usr/local/bin/cloudflared",
                "/usr/bin/cloudflared",
                "/bin/cloudflared",
                "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
                "C:\\Program Files\\cloudflared\\cloudflared.exe",
            ],
            Self::get_cloudflared_version,
        )
    }

    /// `name` is a fixed binary name (never user input); it is used in the
    /// `which`/`where` lookup.
    fn detect_binary(
        name: &str,
        well_known: &[&str],
        get_version: fn(&Path) -> Option<String>,
    ) -> DetectFrpcResult {
        // 1. Priority 1: ~/.local/bin/<name>*
        if let Some(home) = dirs::home_dir() {
            let local_bin = home.join(".local").join("bin");
            if local_bin.is_dir() {
                let exact_name = if cfg!(windows) {
                    format!("{}.exe", name)
                } else {
                    name.to_string()
                };

                let exact_path = local_bin.join(exact_name);
                if Self::is_executable_binary(&exact_path) {
                    let version = get_version(&exact_path);
                    return DetectFrpcResult {
                        found: true,
                        path: exact_path.to_string_lossy().to_string(),
                        version,
                        source: "local_bin".to_string(),
                    };
                }

                // Check other matching <name>* files in ~/.local/bin/
                if let Ok(entries) = fs::read_dir(&local_bin) {
                    let mut candidates = Vec::new();
                    for entry in entries.filter_map(|e| e.ok()) {
                        let path = entry.path();
                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                            let lower = file_name.to_lowercase();
                            if lower.starts_with(name) && Self::is_executable_binary(&path) {
                                candidates.push(path);
                            }
                        }
                    }
                    candidates.sort_by_key(|p| p.to_string_lossy().len());
                    if let Some(best) = candidates.first() {
                        let version = get_version(best);
                        return DetectFrpcResult {
                            found: true,
                            path: best.to_string_lossy().to_string(),
                            version,
                            source: "local_bin".to_string(),
                        };
                    }
                }
            }
        }

        // 2. Priority 2: Shell `which <name>` / `where <name>`
        if let Some(shell_path) = Self::detect_via_shell(name) {
            if Self::is_executable_binary(&shell_path) {
                let version = get_version(&shell_path);
                return DetectFrpcResult {
                    found: true,
                    path: shell_path.to_string_lossy().to_string(),
                    version,
                    source: "shell".to_string(),
                };
            }
        }

        // 3. Priority 3: Well-known directories
        for candidate_str in well_known {
            let path = PathBuf::from(candidate_str);
            if Self::is_executable_binary(&path) {
                let version = get_version(&path);
                return DetectFrpcResult {
                    found: true,
                    path: path.to_string_lossy().to_string(),
                    version,
                    source: "well_known".to_string(),
                };
            }
        }

        DetectFrpcResult {
            found: false,
            path: String::new(),
            version: None,
            source: "none".to_string(),
        }
    }

    /// Use user's shell to resolve `which <name>` or `where <name>`
    fn detect_via_shell(name: &str) -> Option<PathBuf> {
        #[cfg(unix)]
        {
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
            if let Ok(output) = std::process::Command::new(&shell)
                .args(["-l", "-c", &format!("which {}", name)])
                .output()
            {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !out_str.is_empty() {
                        let path = PathBuf::from(out_str);
                        if path.exists() {
                            return Some(path);
                        }
                    }
                }
            }

            if let Ok(output) = std::process::Command::new("which")
                .arg(name)
                .output()
            {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !out_str.is_empty() {
                        let path = PathBuf::from(out_str);
                        if path.exists() {
                            return Some(path);
                        }
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            if let Ok(output) = std::process::Command::new("cmd")
                .args(["/c", &format!("where {}", name)])
                .output()
            {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout);
                    for line in out_str.lines() {
                        let trimmed = line.trim();
                        if !trimmed.is_empty() {
                            let path = PathBuf::from(trimmed);
                            if path.exists() {
                                return Some(path);
                            }
                        }
                    }
                }
            }
        }

        None
    }

    /// Validate a given user path and return version or error
    pub fn validate_path(raw: &str) -> Result<String, String> {
        Self::validate_path_with(raw, Self::get_frpc_version)
    }

    pub fn validate_cloudflared_path(raw: &str) -> Result<String, String> {
        Self::validate_path_with(raw, Self::get_cloudflared_version)
    }

    fn validate_path_with(
        raw: &str,
        get_version: fn(&Path) -> Option<String>,
    ) -> Result<String, String> {
        let path = Self::resolve_path(raw);
        if !path.exists() {
            return Err("文件不存在".to_string());
        }
        if !Self::is_executable_binary(&path) {
            return Err("文件不是可执行程序或无执行权限".to_string());
        }
        match get_version(&path) {
            Some(v) => Ok(v),
            None => Ok("已识别为可执行文件 (未知版本)".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_path() {
        let home = dirs::home_dir().unwrap();
        assert_eq!(FrpcDetector::resolve_path("~/test"), home.join("test"));
        assert_eq!(FrpcDetector::resolve_path("/usr/bin/frpc"), PathBuf::from("/usr/bin/frpc"));
    }

    #[test]
    fn test_detect() {
        let res = FrpcDetector::detect();
        println!("Detected frpc: {:?}", res);
        // If frpc is installed on host (like /opt/homebrew/bin/frpc), it should find it
        if Path::new("/opt/homebrew/bin/frpc").exists() {
            assert!(res.found);
            assert!(res.version.is_some());
        }
    }

    #[test]
    fn test_validate_path() {
        if Path::new("/opt/homebrew/bin/frpc").exists() {
            let ver = FrpcDetector::validate_path("/opt/homebrew/bin/frpc").unwrap();
            assert!(!ver.is_empty());
        }
        assert!(FrpcDetector::validate_path("/non/existent/frpc").is_err());
    }
}
