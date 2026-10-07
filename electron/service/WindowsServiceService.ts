import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import BeanFactory from "../core/BeanFactory";
import { BusinessError, ResponseCode } from "../core/BusinessError";
import VersionRepository from "../repository/VersionRepository";
import { frpcLifecycleGuard } from "../utils/FrpcLifecycleGuard";
import PathUtils from "../utils/PathUtils";
import {
  copyServiceAssets,
  encodedPowerShell,
  psLiteral,
  WINDOWS_SERVICE_NAME
} from "../utils/WindowsServiceConfig";
import ServerService from "./ServerService";
import type FrpcProcessService from "./FrpcProcessService";

const MANAGE_SERVICE_SHA256 =
  "cd4408ef97349f869e5d67b6c5c026386b21fa0558adccd4b35550fcf2fc9df2";

class WindowsServiceService {
  private _status: WindowsServiceStatus = {
    supported: process.platform === "win32",
    installed: false,
    running: false,
    deploymentExists: false,
    lastStartTime: -1,
    state: "notInstalled",
    directory: ""
  };
  private _queryTail: Promise<void> = Promise.resolve();

  get installed(): boolean {
    return this._status.installed;
  }

  get running(): boolean {
    return this._status.running;
  }

  get lastStartTime(): number {
    return this._status.lastStartTime;
  }

  get logPath(): string | null {
    return this.installed
      ? path.join(this._status.directory, "logs", "frpc.log")
      : null;
  }

  private resourcePath(filename: string): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, "windows-service", filename)
      : path.join(app.getAppPath(), "resources", "windows-service", filename);
  }

  private runPowerShell(script: string, timeout = 15000): Promise<string> {
    const executable = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    return new Promise((resolve, reject) => {
      execFile(
        executable,
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          encodedPowerShell(script)
        ],
        { windowsHide: true, timeout, maxBuffer: 1024 * 1024 },
        (error, stdout) => (error ? reject(error) : resolve(stdout.trim()))
      );
    });
  }

  async getStatus(): Promise<WindowsServiceStatus> {
    if (!this._status.supported) return { ...this._status };
    // Serialize queries, including the final post-operation query. An older
    // WMI result must never overwrite a newer result or cache a prior snapshot.
    const query = this._queryTail.then(() => this.queryStatus());
    this._queryTail = query.then(
      () => undefined,
      () => undefined
    );
    return query;
  }

  private async queryStatus(): Promise<WindowsServiceStatus> {
    try {
      const output = await this.runPowerShell(`
$ErrorActionPreference = 'Stop'
$root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) '${WINDOWS_SERVICE_NAME}'
$service = Get-CimInstance Win32_Service -Filter "Name='${WINDOWS_SERVICE_NAME}'"
if ($service) {
  $servicePath = if ($service.PathName -match '^\\s*"([^"]+)"') { $Matches[1] } else { ($service.PathName -split '\\s+', 2)[0] }
  if ([IO.Path]::GetFullPath($servicePath) -ne [IO.Path]::GetFullPath((Join-Path $root 'service.exe'))) { throw 'SERVICE_CONFLICT' }
}
$deploymentExists = Test-Path -LiteralPath $root
$startTime = -1
if ($service -and $service.State -eq 'Running' -and $service.ProcessId) {
  $process = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($service.ProcessId) AND Name='frpc.exe'" | Select-Object -First 1
  if (!$process) { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($service.ProcessId)" }
  if ($process.CreationDate) { $startTime = ([DateTimeOffset]$process.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds() }
}
@{ supported = $true; installed = [bool]$service; running = [bool]($service -and $service.State -eq 'Running'); deploymentExists = [bool]$deploymentExists; lastStartTime = $startTime; state = $(if (!$service) { if ($deploymentExists) { 'cleanupRequired' } else { 'notInstalled' } } elseif ($service.State -eq 'Running') { 'running' } elseif ($service.State -eq 'Stopped') { 'stopped' } else { 'pending' }); directory = $root } | ConvertTo-Json -Compress
`);
      const status = JSON.parse(output) as WindowsServiceStatus;
      if (
        typeof status.installed !== "boolean" ||
        typeof status.running !== "boolean" ||
        typeof status.deploymentExists !== "boolean" ||
        !Number.isFinite(status.lastStartTime) ||
        ![
          "notInstalled",
          "running",
          "stopped",
          "pending",
          "cleanupRequired"
        ].includes(status.state) ||
        !path.isAbsolute(status.directory)
      ) {
        throw new Error("SERVICE_STATUS_FAILED");
      }
      this._status = status;
      return { ...status };
    } catch {
      throw new Error("SERVICE_STATUS_FAILED");
    }
  }

  async manage(action: WindowsServiceAction): Promise<WindowsServiceStatus> {
    if (!this._status.supported) throw new Error("SERVICE_UNSUPPORTED");
    return frpcLifecycleGuard.run(async () => {
      if (action === "install") {
        await this.getStatus();
        const processService: FrpcProcessService =
          BeanFactory.getBean("frpcProcessService");
        await processService.assertNoGuiProcess();
      }
      return this.performAction(action);
    });
  }

  private async performAction(
    action: WindowsServiceAction
  ): Promise<WindowsServiceStatus> {
    const status = await this.getStatus();
    if (action === "install" && status.installed)
      throw new Error("SERVICE_CONFLICT");
    if (
      action !== "install" &&
      !status.installed &&
      !(action === "uninstall" && status.deploymentExists)
    )
      throw new Error("SERVICE_NOT_INSTALLED");
    const deploymentDirectory = status.directory;
    // A standard user may complete UAC with a different administrator
    // account. Use the shared Windows temp directory so that administrator
    // elevation can reach the staged payload and write result.json.
    const tempRoot =
      process.platform === "win32"
        ? path.join(process.env.WINDIR || "C:\\Windows", "Temp")
        : app.getPath("temp");
    const staging = await fs.promises.mkdtemp(
      path.join(tempRoot, "frpc-service-")
    );
    try {
      const sid = await this.runPowerShell(
        "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value"
      );
      if (!/^S-1-\d+(?:-\d+)+$/.test(sid))
        throw new Error("SERVICE_IDENTITY_FAILED");
      // Administrators includes an alternate account used at a credential UAC
      // prompt. Existing children are created only after this restricted ACL.
      await this.runPowerShell(`
$ErrorActionPreference = 'Stop'
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @('${sid}', 'S-1-5-18', 'S-1-5-32-544')) {
  $rule = New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath ${psLiteral(staging)} -AclObject $acl
`);
      const generation = randomUUID();
      if (action === "install" || action === "sync") {
        const serverService: ServerService =
          BeanFactory.getBean("serverService");
        const repository: VersionRepository =
          BeanFactory.getBean("versionRepository");
        const snapshot = await serverService.captureConfigSnapshot();
        if (!snapshot.server?.serverAddr)
          throw new BusinessError(ResponseCode.NOT_CONFIG);
        const version = await repository.findByGithubReleaseId(
          snapshot.server.frpcVersion
        );
        if (!version) throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
        const payload = path.join(staging, "payload");
        await fs.promises.mkdir(payload);
        await fs.promises.copyFile(
          path.join(version.localPath, PathUtils.getWinFrpFilename()),
          path.join(payload, "frpc.exe")
        );
        await serverService.genTomlConfig(path.join(payload, "frpc.toml"), {
          snapshot,
          logPath: path.join(deploymentDirectory, "logs", "frpc.log"),
          transform: generated =>
            copyServiceAssets(
              generated,
              payload,
              path.join(deploymentDirectory, "generations", generation),
              version.localPath
            )
        });
        if (action === "install") {
          await fs.promises.copyFile(
            this.resourcePath("LICENSE.WinSW.txt"),
            path.join(staging, "LICENSE.WinSW.txt")
          );
        }
      }
      // Use the packaged helper path, and verify its hash immediately before
      // elevation so a user-writable script cannot be substituted.
      const command = `
$helperPath = ${psLiteral(this.resourcePath("manage-service.ps1"))}
$helperHash = (Get-FileHash -LiteralPath $helperPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($helperHash -ne '${MANAGE_SERVICE_SHA256}') { throw 'SERVICE_HELPER_INTEGRITY_FAILED' }
& $helperPath -Action ${psLiteral(action)} -Stage ${psLiteral(staging)} -Generation ${psLiteral(generation)} -CallerSid ${psLiteral(sid)} -GuiConfig ${psLiteral(PathUtils.getTomlConfigFilePath())} -WrapperSource ${psLiteral(this.resourcePath("WinSW.NET461.exe"))}
`;
      // The elevated command is encoded too: no user-controlled path becomes
      // PowerShell code or a Windows command-line quoting boundary.
      await this.runPowerShell(
        `
$ErrorActionPreference = 'Stop'
$p = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -Verb RunAs -WindowStyle Hidden -PassThru -Wait -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '${encodedPowerShell(command)}')
if ($p.ExitCode -ne 0) { exit 1 }
`,
        0
      ).catch(() => {
        throw new Error("SERVICE_ELEVATION_FAILED");
      });
      const result = JSON.parse(
        await fs.promises.readFile(path.join(staging, "result.json"), "utf8")
      );
      if (!result.success)
        throw new Error(result.code || "SERVICE_OPERATION_FAILED");
      return await this.getStatus();
    } finally {
      await fs.promises.rm(staging, { recursive: true, force: true });
    }
  }
}

export default WindowsServiceService;
