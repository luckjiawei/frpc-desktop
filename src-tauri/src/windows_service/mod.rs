mod snapshot;

use crate::models::{FrpcProcessStatus, FrpcProxy, OpenSourceFrpcDesktopServer};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::sync::Mutex;

const HELPER: &str = include_str!("../../../resources/windows-service/manage-service.ps1");
const LICENSE: &str = include_str!("../../../resources/windows-service/LICENSE.WinSW.txt");
const STATUS_SCRIPT: &str = include_str!("../../../resources/windows-service/query-status.ps1");
const WINSW_HASH: &str = "b5066b7bbdfba1293e5d15cda3caaea88fbeab35bd5b38c41c913d492aadfc4f";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsServiceStatus {
    pub supported: bool,
    pub installed: bool,
    pub running: bool,
    pub deployment_exists: bool,
    pub last_start_time: i64,
    pub state: String,
    pub directory: PathBuf,
}

impl WindowsServiceStatus {
    pub fn process_status(&self) -> FrpcProcessStatus {
        FrpcProcessStatus {
            running: self.running,
            connection_error: None,
            last_start_time: (self.last_start_time > 0).then_some(self.last_start_time),
        }
    }

    pub fn blocks_reset(&self) -> bool {
        self.installed || self.deployment_exists
    }

    pub fn log_path(&self) -> Option<PathBuf> {
        self.installed
            .then(|| self.directory.join("logs").join("frpc.log"))
    }
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceAction {
    Install,
    Start,
    Stop,
    Sync,
    Uninstall,
}

impl ServiceAction {
    fn as_str(self) -> &'static str {
        match self {
            Self::Install => "install",
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Sync => "sync",
            Self::Uninstall => "uninstall",
        }
    }

    pub fn needs_snapshot(self) -> bool {
        matches!(self, Self::Install | Self::Sync)
    }
}

pub struct ServiceSnapshot {
    pub server: OpenSourceFrpcDesktopServer,
    pub proxies: Vec<FrpcProxy>,
    pub binary: PathBuf,
}

#[derive(Default)]
pub struct WindowsServiceManager {
    query_lock: Mutex<()>,
}

impl WindowsServiceManager {
    pub async fn status(&self) -> Result<WindowsServiceStatus, String> {
        if !cfg!(windows) {
            return Ok(WindowsServiceStatus {
                supported: false,
                installed: false,
                running: false,
                deployment_exists: false,
                last_start_time: -1,
                state: "notInstalled".into(),
                directory: PathBuf::new(),
            });
        }
        let _query = self.query_lock.lock().await;
        let output = powershell(STATUS_SCRIPT, true)
            .await
            .map_err(|_| "SERVICE_STATUS_FAILED")?;
        let status: WindowsServiceStatus =
            serde_json::from_str(output.trim()).map_err(|_| "SERVICE_STATUS_FAILED")?;
        if !status.supported
            || !status.directory.is_absolute()
            || !matches!(
                status.state.as_str(),
                "notInstalled" | "running" | "stopped" | "pending" | "cleanupRequired"
            )
        {
            return Err("SERVICE_STATUS_FAILED".into());
        }
        Ok(status)
    }

    // The caller holds AppState's lifecycle lock across snapshot capture and UAC.
    pub async fn manage(
        &self,
        app: &AppHandle,
        action: ServiceAction,
        gui_config: &Path,
        snapshot: Option<ServiceSnapshot>,
    ) -> Result<WindowsServiceStatus, String> {
        if !cfg!(windows) {
            return Err("SERVICE_UNSUPPORTED".into());
        }
        let status = self.status().await?;
        if action == ServiceAction::Install && status.installed {
            return Err("SERVICE_CONFLICT".into());
        }
        if action != ServiceAction::Install
            && !status.installed
            && !(action == ServiceAction::Uninstall && status.deployment_exists)
        {
            return Err("SERVICE_NOT_INSTALLED".into());
        }
        if action == ServiceAction::Start && status.running {
            return Ok(status);
        }
        if action == ServiceAction::Install {
            powershell(&format!(
                "$ErrorActionPreference = 'Stop'; $config = {}; if (Get-CimInstance Win32_Process | Where-Object {{ $_.CommandLine -and $_.CommandLine.Contains($config) -and $_.Name -ne 'powershell.exe' }}) {{ throw 'SERVICE_STOP_GUI_FIRST' }}",
                ps_literal(&gui_config.to_string_lossy())
            ), true).await.map_err(|_| "SERVICE_STOP_GUI_FIRST")?;
        }

        let sid = powershell(
            "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
            true,
        )
        .await?;
        let sid = sid.trim();
        if !valid_sid(sid) {
            return Err("SERVICE_IDENTITY_FAILED".into());
        }
        // Shared temp supports UAC credentials belonging to a different admin.
        let windows = std::env::var_os("SystemRoot").ok_or("SERVICE_UNSAFE_PATH")?;
        let stage = tempfile::Builder::new()
            .prefix("frpc-service-")
            .tempdir_in(PathBuf::from(windows).join("Temp"))
            .map_err(|_| "SERVICE_OPERATION_FAILED")?;
        powershell(&format!(r#"
$ErrorActionPreference = 'Stop'
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @('{sid}', 'S-1-5-18', 'S-1-5-32-544')) {{
  $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
}}
Set-Acl -LiteralPath {stage_path} -AclObject $acl
"#, stage_path = ps_literal(&stage.path().to_string_lossy())), true).await?;

        let generation = uuid::Uuid::new_v4().to_string();
        if action.needs_snapshot() {
            let snapshot = snapshot.ok_or("SERVICE_PAYLOAD_MISSING")?;
            // A batch script cannot be deployed as a LocalService executable.
            if !snapshot
                .binary
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))
            {
                return Err("SERVICE_PAYLOAD_MISSING".into());
            }
            snapshot::prepare_snapshot(
                &snapshot.server,
                &snapshot.proxies,
                &snapshot.binary,
                &stage.path().join("payload"),
                &status.directory.join("generations").join(&generation),
                &status.directory.join("logs").join("frpc.log"),
            )?;
        }
        std::fs::write(stage.path().join("LICENSE.WinSW.txt"), LICENSE)
            .map_err(|_| "SERVICE_OPERATION_FAILED")?;
        let helper_path = stage.path().join("manage-service.ps1");
        std::fs::write(&helper_path, HELPER).map_err(|_| "SERVICE_OPERATION_FAILED")?;
        let wrapper = wrapper_path(app)?;
        if action == ServiceAction::Install {
            let bytes = std::fs::read(&wrapper).map_err(|_| "SERVICE_HOST_INTEGRITY_FAILED")?;
            if hash(&bytes) != WINSW_HASH {
                return Err("SERVICE_HOST_INTEGRITY_FAILED".into());
            }
        }
        // Hash and parse the same open stream in the elevated process, so a
        // user-writable staged helper cannot be substituted after verification.
        let elevated = format!(
            r#"
$ErrorActionPreference = 'Stop'
$stream = [IO.File]::Open({helper}, 'Open', 'Read', 'Read')
$sha = [Security.Cryptography.SHA256]::Create()
try {{
  $digest = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
  if ($digest -ne '{helper_hash}') {{ throw 'SERVICE_HELPER_INTEGRITY_FAILED' }}
  $stream.Position = 0
  $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::UTF8)
  $script = [ScriptBlock]::Create($reader.ReadToEnd())
  & $script -Action {action} -Stage {stage} -Generation '{generation}' -CallerSid '{sid}' -GuiConfig {gui_config} -WrapperSource {wrapper}
}} finally {{ $sha.Dispose(); $stream.Dispose() }}
"#,
            helper = ps_literal(&helper_path.to_string_lossy()),
            helper_hash = hash(HELPER.as_bytes()),
            action = ps_literal(action.as_str()),
            stage = ps_literal(&stage.path().to_string_lossy()),
            gui_config = ps_literal(&gui_config.to_string_lossy()),
            wrapper = ps_literal(&wrapper.to_string_lossy())
        );
        let launcher = format!(
            r#"
$ErrorActionPreference = 'Stop'
$p = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -Verb RunAs -WindowStyle Hidden -PassThru -Wait -ArgumentList @('-NoProfile', '-NonInteractive', '-EncodedCommand', '{}')
if ($p.ExitCode -ne 0) {{ exit 1 }}
"#,
            encoded_powershell(&elevated)
        );
        // Do not time out UAC and delete staging while an elevated child owns it.
        powershell(&launcher, false)
            .await
            .map_err(|_| "SERVICE_ELEVATION_FAILED")?;
        #[derive(Deserialize)]
        struct OperationResult {
            success: bool,
            code: Option<String>,
        }
        let result: OperationResult = serde_json::from_slice(
            &std::fs::read(stage.path().join("result.json"))
                .map_err(|_| "SERVICE_OPERATION_FAILED")?,
        )
        .map_err(|_| "SERVICE_OPERATION_FAILED")?;
        if !result.success {
            return Err(result
                .code
                .filter(|code| code.starts_with("SERVICE_"))
                .unwrap_or_else(|| "SERVICE_OPERATION_FAILED".into()));
        }
        self.status().await
    }
}

fn wrapper_path(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../resources/windows-service/WinSW.NET461.exe"))
    }
    #[cfg(not(debug_assertions))]
    {
        use tauri::Manager;
        _app.path()
            .resource_dir()
            .map(|path| path.join("windows-service/WinSW.NET461.exe"))
            .map_err(|_| "SERVICE_HOST_INTEGRITY_FAILED".into())
    }
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn ps_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn encoded_powershell(script: &str) -> String {
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    STANDARD.encode(bytes)
}

fn valid_sid(sid: &str) -> bool {
    sid.starts_with("S-1-")
        && sid[4..].split('-').count() >= 2
        && sid[4..]
            .split('-')
            .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
}

async fn powershell(script: &str, bounded: bool) -> Result<String, String> {
    #[cfg(not(windows))]
    {
        let _ = (script, bounded);
        Err("SERVICE_UNSUPPORTED".into())
    }
    #[cfg(windows)]
    {
        use std::process::Stdio;
        let root = std::env::var_os("SystemRoot").ok_or("SERVICE_UNSAFE_PATH")?;
        let executable = PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let child = tokio::process::Command::new(executable)
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-EncodedCommand",
                &encoded_powershell(script),
            ])
            .creation_flags(0x08000000)
            .kill_on_drop(true)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|_| "SERVICE_OPERATION_FAILED")?;
        let output = if bounded {
            tokio::time::timeout(std::time::Duration::from_secs(15), child.wait_with_output())
                .await
                .map_err(|_| "SERVICE_STATUS_FAILED")?
        } else {
            child.wait_with_output().await
        }
        .map_err(|_| "SERVICE_OPERATION_FAILED")?;
        if !output.status.success() {
            return Err("SERVICE_OPERATION_FAILED".into());
        }
        String::from_utf8(output.stdout).map_err(|_| "SERVICE_OPERATION_FAILED".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn status_query_is_read_only_and_reports_platform_support() {
        let status = WindowsServiceManager::default().status().await.unwrap();
        assert_eq!(status.supported, cfg!(windows));
        if cfg!(windows) {
            assert!(status.directory.is_absolute());
        } else {
            assert!(!status.blocks_reset());
        }
    }

    #[test]
    fn powershell_literals_and_encoding_preserve_paths() {
        let value = "E:\\中文\\it's a file; $(test).pem";
        assert_eq!(ps_literal(value), "'E:\\中文\\it''s a file; $(test).pem'");
        let bytes = STANDARD.decode(encoded_powershell(value)).unwrap();
        let words: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        assert_eq!(String::from_utf16(&words).unwrap(), value);
    }

    #[test]
    fn actions_and_sids_reject_untrusted_input() {
        assert!(serde_json::from_str::<ServiceAction>("\"install\"").is_ok());
        assert!(serde_json::from_str::<ServiceAction>("\"install; bad\"").is_err());
        assert!(valid_sid("S-1-5-21-123-456-789-1001"));
        for invalid in ["S-1-5-", "S-1-5-21'", "", "S-1-5-21;test"] {
            assert!(!valid_sid(invalid));
        }
    }

    #[test]
    fn service_status_preserves_uptime_and_blocks_reset_for_leftovers() {
        let mut status: WindowsServiceStatus = serde_json::from_value(serde_json::json!({
            "supported": true, "installed": true, "running": true,
            "deploymentExists": true, "lastStartTime": 1234567890,
            "state": "running", "directory": "deployment"
        }))
        .unwrap();
        assert!(status.process_status().running);
        assert_eq!(status.process_status().last_start_time, Some(1234567890));
        status.installed = false;
        assert!(status.blocks_reset());
        assert!(status.log_path().is_none());
        status.deployment_exists = false;
        assert!(!status.blocks_reset());
    }

    #[test]
    fn embedded_helper_pins_the_same_host_and_account() {
        assert!(HELPER.contains(WINSW_HASH));
        assert!(HELPER.contains("<domain>NT AUTHORITY</domain><user>LocalService</user>"));
        assert!(HELPER.contains("S-1-5-19"));
        assert_eq!(
            hash(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
