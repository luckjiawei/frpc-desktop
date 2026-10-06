import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import BeanFactory from "../core/BeanFactory";
import { BusinessError, ResponseCode } from "../core/BusinessError";
import VersionRepository from "../repository/VersionRepository";
import PathUtils from "../utils/PathUtils";
import {
  copyServiceAssets,
  encodedPowerShell,
  psLiteral,
  WINDOWS_SERVICE_NAME
} from "../utils/WindowsServiceConfig";
import ServerService from "./ServerService";

class WindowsServiceService {
  private _status: WindowsServiceStatus = {
    supported: process.platform === "win32",
    installed: false,
    running: false,
    state: "notInstalled",
    directory: ""
  };
  private _operation: Promise<WindowsServiceStatus> | null = null;

  get installed(): boolean {
    return this._status.installed;
  }

  get running(): boolean {
    return this._status.running;
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

  private get deploymentDirectory(): string {
    return path.join(
      process.env.ProgramData || "C:\\ProgramData",
      WINDOWS_SERVICE_NAME
    );
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
    const output = await this.runPowerShell(`
$ErrorActionPreference = 'Stop'
$root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) '${WINDOWS_SERVICE_NAME}'
$service = Get-CimInstance Win32_Service -Filter "Name='${WINDOWS_SERVICE_NAME}'"
if ($service) {
  $servicePath = if ($service.PathName -match '^\\s*"([^"]+)"') { $Matches[1] } else { ($service.PathName -split '\\s+', 2)[0] }
  if ([IO.Path]::GetFullPath($servicePath) -ne [IO.Path]::GetFullPath((Join-Path $root 'service.exe'))) { throw 'SERVICE_CONFLICT' }
}
@{ supported = $true; installed = [bool]$service; running = [bool]($service -and $service.State -eq 'Running'); state = $(if (!$service) { 'notInstalled' } elseif ($service.State -eq 'Running') { 'running' } elseif ($service.State -eq 'Stopped') { 'stopped' } else { 'pending' }); directory = $root } | ConvertTo-Json -Compress
`);
    const status = JSON.parse(output) as WindowsServiceStatus;
    if (
      typeof status.installed !== "boolean" ||
      typeof status.running !== "boolean" ||
      !["notInstalled", "running", "stopped", "pending"].includes(
        status.state
      ) ||
      !path.isAbsolute(status.directory)
    ) {
      throw new Error("SERVICE_STATUS_FAILED");
    }
    this._status = status;
    return { ...status };
  }

  async manage(action: WindowsServiceAction): Promise<WindowsServiceStatus> {
    if (!this._status.supported) throw new Error("SERVICE_UNSUPPORTED");
    if (this._operation) throw new Error("SERVICE_BUSY");
    this._operation = this.performAction(action).finally(() => {
      this._operation = null;
    });
    return this._operation;
  }

  private async performAction(
    action: WindowsServiceAction
  ): Promise<WindowsServiceStatus> {
    const status = await this.getStatus();
    if (action === "install" && status.installed)
      throw new Error("SERVICE_CONFLICT");
    if (action !== "install" && !status.installed)
      throw new Error("SERVICE_NOT_INSTALLED");
    const deploymentDirectory = this.deploymentDirectory;
    const staging = await fs.promises.mkdtemp(
      path.join(app.getPath("temp"), "frpc-service-")
    );
    try {
      const generation = randomUUID();
      if (action === "install" || action === "sync") {
        const serverService: ServerService =
          BeanFactory.getBean("serverService");
        const repository: VersionRepository =
          BeanFactory.getBean("versionRepository");
        if (!(await serverService.hasServerConfig()))
          throw new BusinessError(ResponseCode.NOT_CONFIG);
        const config = await serverService.getServerConfig();
        const version = await repository.findByGithubReleaseId(
          config.frpcVersion
        );
        if (!version) throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
        const payload = path.join(staging, "payload");
        await fs.promises.mkdir(payload);
        await fs.promises.copyFile(
          path.join(version.localPath, PathUtils.getWinFrpFilename()),
          path.join(payload, "frpc.exe")
        );
        await serverService.genTomlConfig(path.join(payload, "frpc.toml"), {
          logPath: path.join(deploymentDirectory, "logs", "frpc.log"),
          transform: generated =>
            copyServiceAssets(
              generated,
              payload,
              path.join(deploymentDirectory, "generations", generation)
            )
        });
        if (action === "install") {
          await fs.promises.copyFile(
            this.resourcePath("WinSW.NET461.exe"),
            path.join(staging, "service.exe")
          );
          await fs.promises.copyFile(
            this.resourcePath("LICENSE.WinSW.txt"),
            path.join(staging, "LICENSE.WinSW.txt")
          );
        }
      }
      const sid = await this.runPowerShell(
        "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value"
      );
      if (!/^S-1-\d+(?:-\d+)+$/.test(sid))
        throw new Error("SERVICE_IDENTITY_FAILED");
      const command = `& ${psLiteral(this.resourcePath("manage-service.ps1"))} -Action ${psLiteral(action)} -Stage ${psLiteral(staging)} -Generation ${psLiteral(generation)} -CallerSid ${psLiteral(sid)}`;
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
