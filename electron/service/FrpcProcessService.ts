import { exec, execFileSync, spawn } from "child_process";
import { app, BrowserWindow, Notification } from "electron";
import fs from "fs";
import path from "path";
import treeKill from "tree-kill";
import BeanFactory from "../core/BeanFactory";
import { BusinessError, ResponseCode } from "../core/BusinessError";
import GlobalConstant from "../core/GlobalConstant";
import Logger from "../core/Logger";
import VersionRepository from "../repository/VersionRepository";
import NetUtils from "../utils/NetUtils";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import ServerService from "./ServerService";
import SystemService from "./SystemService";

// Fixed paths with no spaces so sudoers matching is unambiguous
const MAC_LAUNCHER_PATH = "/usr/local/bin/frpc-desktop-launcher";
const MAC_SUDOERS_FILE = "/etc/sudoers.d/frpc-desktop";

// Error patterns that indicate frpc failed to connect to server
const FRPC_ERROR_PATTERNS = [
  "connect to server error",
  "login to server failed"
];
// Success patterns that indicate frpc connected successfully
const FRPC_SUCCESS_PATTERNS = [
  "login to server success",
  "start proxy success",
  "proxy added success"
];
const DISCONNECT_NOTIFICATION_COOLDOWN_MS = 60 * 1000;
const FRPC_RECOVERY_COOLDOWN_MS = 10 * 1000;

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _systemService: SystemService;
  private readonly _versionRepository: VersionRepository;
  private _frpcProcess: any;
  private _frpcProcessManaged = false;
  private _frpcProcessListener: NodeJS.Timeout | null = null;
  private _frpcProcessGuardianTimer: NodeJS.Timeout | null = null;
  private _frpcLastStartTime: number = -1;
  private _notification: number = -1;
  private _frpcRecoveryChecking = false;
  private _frpcLastRecoveryTime = -1;
  private _lastExternalFrpcProbeTime = 0;
  private readonly _externalFrpcProbeIntervalMs = 5 * 1000;
  private _externalFrpcStatus: ExternalFrpcProcessInfo | null = null;

  constructor() {
    this._serverService = BeanFactory.getBean("serverService");
    this._systemService = BeanFactory.getBean("systemService");
    this._versionRepository = BeanFactory.getBean("versionRepository");
  }

  private getFrpcProcessNames() {
    if (process.platform === "win32") {
      return [PathUtils.getWinFrpFilename(), "frpc.exe"];
    }
    return [PathUtils.getFrpcFilename(), "frpc"];
  }

  private splitCommandLine(command: string) {
    const args: Array<string> = [];
    const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
      args.push(match[1] || match[2] || match[3]);
    }
    return args;
  }

  private extractConfigPathFromCommand(command: string) {
    const args = this.splitCommandLine(command);
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if ((arg === "-c" || arg === "--config") && args[i + 1]) {
        const pathParts = [args[i + 1]];
        for (let j = i + 2; j < args.length; j++) {
          if (args[j].startsWith("-")) {
            break;
          }
          pathParts.push(args[j]);
        }
        return pathParts.join(" ");
      }
      if (arg.startsWith("--config=")) {
        const pathParts = [arg.slice("--config=".length)];
        for (let j = i + 1; j < args.length; j++) {
          if (args[j].startsWith("-")) {
            break;
          }
          pathParts.push(args[j]);
        }
        return pathParts.join(" ");
      }
      if (arg.startsWith("-c=")) {
        const pathParts = [arg.slice("-c=".length)];
        for (let j = i + 1; j < args.length; j++) {
          if (args[j].startsWith("-")) {
            break;
          }
          pathParts.push(args[j]);
        }
        return pathParts.join(" ");
      }
    }
    return null;
  }

  private decodeEscapedPath(value: string | null) {
    if (!value || !value.includes("\\x")) {
      return value;
    }

    const bytes: number[] = [];
    for (let i = 0; i < value.length; i++) {
      if (
        value[i] === "\\" &&
        value[i + 1] === "x" &&
        /^[0-9a-fA-F]{2}$/.test(value.slice(i + 2, i + 4))
      ) {
        bytes.push(parseInt(value.slice(i + 2, i + 4), 16));
        i += 3;
      } else {
        bytes.push(...Buffer.from(value[i], "utf-8"));
      }
    }
    return Buffer.from(bytes).toString("utf-8");
  }

  private normalizePid(pid: number) {
    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }
    return pid.toString();
  }

  private getExternalProcessCwd(pid: number): string | null {
    const safePid = this.normalizePid(pid);
    if (!safePid) {
      return null;
    }

    try {
      if (process.platform === "darwin") {
        const stdout = execFileSync("lsof", [
          "-a",
          "-p",
          safePid,
          "-d",
          "cwd",
          "-Fn"
        ])
          .toString()
          .trim();
        const cwdLine = stdout.split("\n").find(line => line.startsWith("n"));
        return cwdLine ? this.decodeEscapedPath(cwdLine.slice(1)) : null;
      }
      if (process.platform === "linux") {
        return fs.realpathSync(`/proc/${pid}/cwd`);
      }
    } catch {
      return null;
    }
    return null;
  }

  private readWindowsProcessCommand(pid: number) {
    const safePid = this.normalizePid(pid);
    if (!safePid) {
      return "";
    }

    try {
      return execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${safePid}'; if ($p) { $p.CommandLine }`
        ],
        { windowsHide: true }
      )
        .toString()
        .trim();
    } catch {
      try {
        const stdout = execFileSync(
          "wmic",
          [
            "process",
            "where",
            `ProcessId=${safePid}`,
            "get",
            "CommandLine",
            "/value"
          ],
          { windowsHide: true }
        )
          .toString()
          .trim();
        const commandLine = stdout
          .split("\n")
          .find(line => line.startsWith("CommandLine="));
        return commandLine
          ? commandLine.slice("CommandLine=".length).trim()
          : "";
      } catch {
        return "";
      }
    }
  }

  private normalizeConfigPath(configPath: string | null) {
    if (!configPath) {
      return null;
    }
    return path.normalize(this.decodeEscapedPath(configPath) || configPath);
  }

  private isAppManagedConfigPath(configPath: string | null) {
    const normalizedConfigPath = this.normalizeConfigPath(configPath);
    if (!normalizedConfigPath) {
      return false;
    }
    return (
      normalizedConfigPath ===
      path.normalize(PathUtils.getTomlConfigFilePath())
    );
  }

  private adoptRunningFrpcProcess(info: ExternalFrpcProcessInfo) {
    this._frpcProcess = { pid: info.pid };
    this._frpcProcessManaged = true;
    if (this._frpcLastStartTime === -1) {
      this._frpcLastStartTime = Date.now();
    }
    this._externalFrpcStatus = null;
    Logger.info(
      `FrpcProcessService.adoptRunningFrpcProcess`,
      `Adopted existing app-managed frpc process, pid=${info.pid}, config=${info.configPath}`
    );
  }

  private findRunningFrpcProcess(
    predicate: (info: ExternalFrpcProcessInfo) => boolean
  ): ExternalFrpcProcessInfo | null {
    if (process.platform !== "win32") {
      for (const processName of this.getFrpcProcessNames()) {
        let stdout = "";
        try {
          stdout = execFileSync("pgrep", ["-x", processName])
            .toString()
            .trim();
        } catch {
          stdout = "";
        }
        const pids = stdout
          .split("\n")
          .map(pid => parseInt(pid, 10))
          .filter(pid => !Number.isNaN(pid));
        for (const pid of pids) {
          const info = this.readExternalProcessInfo(pid, processName);
          if (info && predicate(info)) {
            return info;
          }
        }
      }
      return null;
    }

    for (const processName of this.getFrpcProcessNames()) {
      const stdout = execFileSync("tasklist", [
        "/FI",
        `IMAGENAME eq ${processName}`,
        "/FO",
        "CSV"
      ]).toString();
      const lines = stdout.split("\n").filter(Boolean).slice(1);
      for (const line of lines) {
        const processInfo = line
          .split('","')
          .map(s => s.replace(/(^"|"$)/g, ""));
        const pid = parseInt(processInfo[1], 10);
        if (Number.isNaN(pid)) {
          continue;
        }
        const externalInfo = this.readExternalProcessInfo(pid, processName);
        if (externalInfo && predicate(externalInfo)) {
          return externalInfo;
        }
      }
    }
    return null;
  }

  private adoptExistingAppManagedFrpcProcess() {
    try {
      const info = this.findRunningFrpcProcess(info =>
        this.isAppManagedConfigPath(info.configPath)
      );
      if (!info) {
        return false;
      }
      this.adoptRunningFrpcProcess(info);
      return true;
    } catch (error) {
      Logger.warn(
        `FrpcProcessService.adoptExistingAppManagedFrpcProcess`,
        `Unable to adopt existing frpc process`
      );
      return false;
    }
  }

  private resolveExternalConfigPath(pid: number, configPath: string) {
    if (path.isAbsolute(configPath)) {
      return this.decodeEscapedPath(configPath);
    }
    const cwd = this.getExternalProcessCwd(pid);
    const resolvedPath = cwd
      ? path.resolve(cwd, configPath)
      : path.resolve(configPath);
    return this.decodeEscapedPath(resolvedPath);
  }

  private readExternalProcessInfo(
    pid: number,
    processName: string
  ): ExternalFrpcProcessInfo | null {
    try {
      process.kill(pid, 0);
    } catch (err: any) {
      if (err.code !== "EPERM") {
        return null;
      }
    }

    let command = "";
    try {
      if (process.platform === "win32") {
        command = this.readWindowsProcessCommand(pid);
      } else {
        const safePid = this.normalizePid(pid);
        if (!safePid) {
          return null;
        }
        command = execFileSync("ps", ["-p", safePid, "-o", "command="])
          .toString()
          .trim();
      }
    } catch (error) {
      Logger.warn(
        `FrpcProcessService.readExternalProcessInfo`,
        `Unable to read frpc process command line, pid=${pid}`
      );
    }

    const rawConfigPath = command
      ? this.extractConfigPathFromCommand(command)
      : null;
    const cwd = this.getExternalProcessCwd(pid);
    const configPath = rawConfigPath
      ? this.resolveExternalConfigPath(pid, rawConfigPath)
      : null;

    return {
      pid,
      processName,
      command,
      cwd,
      configPath
    };
  }

  /**
   * Check whether the one-time macOS privileged helper is installed.
   * The helper is a launcher script at a fixed path covered by a sudoers NOPASSWD rule,
   * so subsequent frpc launches require no password prompt.
   */
  private isMacHelperReady(): boolean {
    return fs.existsSync(MAC_LAUNCHER_PATH) && fs.existsSync(MAC_SUDOERS_FILE);
  }

  /**
   * Install the macOS privileged helper (one-time, shows a single password dialog).
   * Writes a launcher script to /usr/local/bin and a sudoers NOPASSWD rule so that
   * frpc can be started/stopped without further password prompts.
   */
  private async installMacHelper(): Promise<void> {
    // Launcher script: accepts "start <binary> <config>" or "stop <pid>"
    const launcherContent = [
      "#!/bin/bash",
      'ACTION="$1"',
      'if [ "$ACTION" = "start" ]; then',
      '  "$2" -c "$3" &',
      "  echo $!",
      'elif [ "$ACTION" = "stop" ]; then',
      '  kill "$2"',
      "fi",
      ""
    ].join("\n");

    const tempLauncher = "/tmp/frpc_desktop_launcher_setup.sh";
    const username = process.env.USER || "ALL";
    const tempSudoers = "/tmp/frpc_desktop_sudoers_setup";

    fs.writeFileSync(tempLauncher, launcherContent, { mode: 0o644 });
    fs.writeFileSync(
      tempSudoers,
      `${username} ALL=(ALL) NOPASSWD: ${MAC_LAUNCHER_PATH}\n`,
      { mode: 0o644 }
    );

    // All paths (/tmp/..., /usr/local/bin/..., /etc/...) contain no spaces,
    // so no quoting is needed inside the AppleScript string literal.
    const installCmd = [
      `mkdir -p /usr/local/bin`,
      `cp ${tempLauncher} ${MAC_LAUNCHER_PATH}`,
      `chmod 755 ${MAC_LAUNCHER_PATH}`,
      `chown root:wheel ${MAC_LAUNCHER_PATH}`,
      `cp ${tempSudoers} ${MAC_SUDOERS_FILE}`,
      `chmod 440 ${MAC_SUDOERS_FILE}`,
      `chown root:wheel ${MAC_SUDOERS_FILE}`
    ].join(" && ");

    Logger.info(
      "FrpcProcessService.installMacHelper",
      "Installing privileged helper (one-time password prompt)"
    );

    await new Promise<void>((resolve, reject) => {
      exec(
        `osascript -e 'do shell script "${installCmd}" with administrator privileges'`,
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    Logger.info(
      "FrpcProcessService.installMacHelper",
      `Privileged helper installed successfully: launcher=${MAC_LAUNCHER_PATH}`
    );
  }

  isRunning(): boolean {
    if (!this._frpcProcess || !this._frpcProcessManaged) {
      return this.adoptExistingAppManagedFrpcProcess();
    }
    try {
      process.kill(this._frpcProcess.pid, 0);
      return true;
    } catch (err: any) {
      // EPERM means process exists but we lack permission (e.g. root-owned on macOS)
      if (err.code === "EPERM") {
        return true;
      }
      this._frpcProcess = null;
      this._frpcProcessManaged = false;
      return this.adoptExistingAppManagedFrpcProcess();
    }
  }

  get frpcLastStartTime(): number {
    return this._frpcLastStartTime;
  }

  getExternalFrpcStatus(force = false): ExternalFrpcProcessInfo | null {
    const now = Date.now();
    if (
      !force &&
      now - this._lastExternalFrpcProbeTime < this._externalFrpcProbeIntervalMs
    ) {
      return this._externalFrpcStatus;
    }
    this._lastExternalFrpcProbeTime = now;
    this._externalFrpcStatus = null;

    try {
      const info = this.findRunningFrpcProcess(info => {
        if (this._frpcProcessManaged && this._frpcProcess?.pid === info.pid) {
          return false;
        }
        if (this.isAppManagedConfigPath(info.configPath)) {
          this.adoptRunningFrpcProcess(info);
          return false;
        }
        return true;
      });
      if (info) {
        this._externalFrpcStatus = info;
        return info;
      }
    } catch (error) {
      Logger.warn(
        `FrpcProcessService.getExternalFrpcStatus`,
        `Unable to detect external frpc process`
      );
    }
    return null;
  }

  async importExternalFrpcConfig() {
    const externalFrpc = this.getExternalFrpcStatus(true);
    if (!externalFrpc) {
      throw new Error("未检测到外部 frpc 服务");
    }
    if (!externalFrpc.configPath) {
      throw new Error("未能从外部 frpc 启动命令中读取配置文件路径");
    }
    return await this._serverService.syncTomlConfigFile(
      externalFrpc.configPath
    );
  }

  /**
   * Read the last portion of the frpc log file and detect connection errors.
   * Scans backward through recent lines:
   * - Returns the error message if the last relevant line is an error
   * - Returns null if a success line appears after any errors (reconnected)
   * - Returns null if no relevant lines found
   */
  readFrpcConnectionError(): string | null {
    const logPath = PathUtils.getFrpcLogFilePath();
    if (!fs.existsSync(logPath) || this._frpcLastStartTime === -1) {
      return null;
    }
    try {
      const stat = fs.statSync(logPath);
      if (stat.size === 0) return null;
      const readSize = Math.min(stat.size, 8192);
      const buf = Buffer.alloc(readSize);
      const fd = fs.openSync(logPath, "r");
      fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
      fs.closeSync(fd);
      const lines = buf
        .toString("utf-8")
        .split("\n")
        .filter(l => l.trim());
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (FRPC_SUCCESS_PATTERNS.some(p => line.includes(p))) {
          return null;
        }
        const errorPattern = FRPC_ERROR_PATTERNS.find(p => line.includes(p));
        if (errorPattern) {
          const match = line.match(new RegExp(`${errorPattern}.*`));
          return match ? match[0].trim() : line.trim();
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async startFrpcProcess() {
    if (this.isRunning()) {
      Logger.info(
        `FrpcProcessService.startFrpcProcess`,
        `Already running, pid: ${this._frpcProcess.pid}`
      );
      return;
    }
    if (!(await this._serverService.hasServerConfig())) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const config = await this._serverService.getServerConfig();

    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    if (!version) {
      throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
    }

    // Check binary actually exists (may have been deleted by antivirus)
    const frpcFilename =
      process.platform === "win32"
        ? PathUtils.getWinFrpFilename()
        : PathUtils.getFrpcFilename();
    const frpcBinaryPath = path.join(version.localPath, frpcFilename);
    if (!fs.existsSync(frpcBinaryPath)) {
      Logger.warn(
        `FrpcProcessService.startFrpcProcess`,
        `Binary not found at ${frpcBinaryPath}, removing stale DB record`
      );
      await this._versionRepository.deleteById(version._id);
      throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
    }

    Logger.info(
      `FrpcProcessService.startFrpcProcess`,
      `Starting frpc. version=${version.name}, platform=${process.platform}/${process.arch}, localPath=${version.localPath}`
    );

    if (config.webServer.port) {
      const isPortInUse = await NetUtils.checkPortInUse(
        config.webServer.port,
        "127.0.0.1"
      );
      if (isPortInUse) {
        Logger.warn(
          `FrpcProcessService.startFrpcProcess`,
          `Web Server Port ${config.webServer.port} is already in use`
        );
        throw new BusinessError(ResponseCode.WEB_SERVER_PORT_IN_USE);
      }
    }

    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);

    Logger.debug(
      `FrpcProcessService.startFrpcProcess`,
      `Config generated at: ${configPath}`
    );

    if (process.platform === "darwin") {
      // macOS: use the privileged helper (installed once) so no per-launch password prompt
      if (!this.isMacHelperReady()) {
        await this.installMacHelper();
      }

      // Pre-create the log file as the current user so frpc (running as root)
      // appends to it without changing ownership, keeping it readable by this app.
      const logFilePath = PathUtils.getFrpcLogFilePath();
      if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, "", { mode: 0o644 });
      }

      const frpcBinary = path.join(
        version.localPath,
        PathUtils.getFrpcFilename()
      );

      Logger.info(
        `FrpcProcessService.startFrpcProcess`,
        `macOS: launching via sudo -n ${MAC_LAUNCHER_PATH}, binary=${frpcBinary}`
      );

      // sudo -n is non-interactive; NOPASSWD sudoers rule allows this without a prompt
      const pidStr = await new Promise<string>((resolve, reject) => {
        exec(
          `sudo -n "${MAC_LAUNCHER_PATH}" start "${frpcBinary}" "${configPath}"`,
          (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout.trim());
          }
        );
      });

      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid)) {
        this._frpcProcess = { pid };
        this._frpcProcessManaged = true;
        Logger.info(
          `FrpcProcessService.startFrpcProcess`,
          `frpc started successfully (macOS), pid=${pid}`
        );
      } else {
        Logger.warn(
          `FrpcProcessService.startFrpcProcess`,
          `frpc started but pid is invalid: "${pidStr}"`
        );
      }
      this._frpcLastStartTime = Date.now();
      return;
    }

    let command = "";
    if (process.platform === "win32") {
      command = `${PathUtils.getWinFrpFilename()} -c "${configPath}"`;
    } else {
      command = `./${PathUtils.getFrpcFilename()} -c "${configPath}"`;
    }

    let frpcStdout = "";
    let frpcStderr = "";
    this._frpcProcess = spawn(command, {
      cwd: version.localPath,
      shell: true
    });
    this._frpcProcessManaged = true;
    this._frpcLastStartTime = Date.now();
    Logger.info(
      `FrpcProcessService.startFrpcProcess`,
      `frpc started successfully, pid=${this._frpcProcess.pid}`
    );

    this._frpcProcess.stdout.on("data", data => {
      const message = data.toString();
      frpcStdout += message;
      Logger.debug(`FrpcProcessService.startFrpcProcess`, `stdout: ${message}`);
    });

    this._frpcProcess.stderr.on("data", data => {
      const message = data.toString();
      frpcStderr += message;
      Logger.warn(`FrpcProcessService.startFrpcProcess`, `stderr: ${message}`);
    });

    this._frpcProcess.on("error", error => {
      Logger.error(`FrpcProcessService.startFrpcProcess`, error);
    });

    this._frpcProcess.on("exit", (code, signal) => {
      const exitMessage = [
        `frpc exited, code=${code}, signal=${signal}`,
        frpcStderr.trim() ? `stderr: ${frpcStderr.trim()}` : "",
        frpcStdout.trim() ? `stdout: ${frpcStdout.trim()}` : ""
      ]
        .filter(Boolean)
        .join("\n");
      if (code && code !== 0) {
        Logger.error(
          `FrpcProcessService.startFrpcProcess`,
          new Error(exitMessage)
        );
      } else {
        Logger.warn(`FrpcProcessService.startFrpcProcess`, exitMessage);
      }
      this._frpcProcess = null;
      this._frpcProcessManaged = false;
    });
  }

  async stopFrpcProcess() {
    if (this._frpcProcess && this.isRunning()) {
      const pid = this._frpcProcess.pid;
      Logger.info(
        `FrpcProcessService.stopFrpcProcess`,
        `Stopping frpc, pid=${pid}`
      );

      if (process.platform === "darwin") {
        // macOS: frpc runs as root; use the privileged helper to kill it
        try {
          await new Promise<void>((resolve, reject) => {
            exec(`sudo -n "${MAC_LAUNCHER_PATH}" stop ${pid}`, err => {
              if (err) reject(err);
              else resolve();
            });
          });
          Logger.info(
            `FrpcProcessService.stopFrpcProcess`,
            `frpc stopped successfully (macOS), pid=${pid}`
          );
        } catch (e) {
          Logger.error(`FrpcProcessService.stopFrpcProcess`, e as Error);
        }
        this._frpcProcess = null;
        this._frpcProcessManaged = false;
        this._frpcLastStartTime = -1;
        this._notification = -1;
        this._frpcRecoveryChecking = false;
        this._frpcLastRecoveryTime = -1;
        return;
      }

      treeKill(pid, (error: Error) => {
        if (error) {
          Logger.error(`FrpcProcessService.stopFrpcProcess`, error);
          throw error;
        } else {
          Logger.info(
            `FrpcProcessService.stopFrpcProcess`,
            `frpc stopped successfully, pid=${pid}`
          );
          this._frpcProcess = null;
          this._frpcProcessManaged = false;
          this._frpcLastStartTime = -1;
          this._notification = -1;
          this._frpcRecoveryChecking = false;
          this._frpcLastRecoveryTime = -1;
        }
      });
    }
  }

  async stopExternalFrpcProcess() {
    const externalFrpc = this.getExternalFrpcStatus(true);
    if (!externalFrpc) {
      return null;
    }
    const pid = externalFrpc.pid;
    Logger.info(
      `FrpcProcessService.stopExternalFrpcProcess`,
      `Stopping external frpc, pid=${pid}`
    );

    try {
      process.kill(pid, "SIGTERM");
    } catch (error: any) {
      if (process.platform === "darwin" && error?.code === "EPERM") {
        if (!this.isMacHelperReady()) {
          await this.installMacHelper();
        }
        await new Promise<void>((resolve, reject) => {
          exec(`sudo -n "${MAC_LAUNCHER_PATH}" stop ${pid}`, err => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        throw error;
      }
    }

    this._externalFrpcStatus = null;
    this._lastExternalFrpcProbeTime = 0;
    return externalFrpc;
  }

  async reloadFrpcProcess() {
    if (!this.isRunning()) {
      return;
    }
    if (!this._frpcProcessManaged) {
      Logger.info(
        `FrpcProcessService.reloadFrpcProcess`,
        `Detected external frpc, skip reload, pid=${this._frpcProcess?.pid}`
      );
      return;
    }
    const config = await this._serverService.getServerConfig();
    if (!config) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);
    let command = "";
    if (process.platform === "win32") {
      command = `${PathUtils.getWinFrpFilename()} reload -c "${configPath}"`;
    } else {
      command = `./${PathUtils.getFrpcFilename()} reload -c "${configPath}"`;
    }
    Logger.info(
      `FrpcProcessService.reloadFrpcProcess`,
      `Reloading frpc config, pid=${this._frpcProcess?.pid}`
    );
    exec(
      command,
      {
        cwd: version.localPath
      },
      (error, stdout, stderr) => {
        if (error) {
          Logger.error(`FrpcProcessService.reloadFrpcProcess`, error);
          return;
        }
        if (stderr) {
          Logger.debug(
            `FrpcProcessService.reloadFrpcProcess`,
            `stderr: ${stderr}`
          );
        }
        if (stdout) {
          Logger.debug(
            `FrpcProcessService.reloadFrpcProcess`,
            `stdout: ${stdout}`
          );
        }
        Logger.info(
          `FrpcProcessService.reloadFrpcProcess`,
          `frpc config reloaded successfully`
        );
      }
    );
  }

  async frpcProcessGuardian() {
    if (this._frpcProcessGuardianTimer) {
      return;
    }
    Logger.info(
      `FrpcProcessService.frpcProcessGuardian`,
      `Guardian started, interval=${GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL}s`
    );
    this._frpcProcessGuardianTimer = setInterval(async () => {
      if (this._frpcRecoveryChecking) {
        return;
      }
      const running = this.isRunning();
      if (!running && this._frpcLastStartTime !== -1) {
        const now = Date.now();
        if (
          this._frpcLastRecoveryTime !== -1 &&
          now - this._frpcLastRecoveryTime < FRPC_RECOVERY_COOLDOWN_MS
        ) {
          return;
        }
        this._frpcRecoveryChecking = true;
        this._frpcLastRecoveryTime = now;
        try {
          const netStatus = await this._systemService.checkInternetConnect();
          if (netStatus) {
            await this.startFrpcProcess();
            Logger.info(
              `FrpcProcessService.frpcProcessGuardian`,
              `Network restored, frpc process restarted.`
            );
          } else {
            Logger.warn(
              `FrpcProcessService.frpcProcessGuardian`,
              `frpc is not running and network is unreachable, waiting for recovery.`
            );
          }
        } catch (error) {
          Logger.error(
            `FrpcProcessService.frpcProcessGuardian`,
            error as Error
          );
        } finally {
          this._frpcRecoveryChecking = false;
        }
      }
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }

  watchFrpcProcess(listenerParam: ListenerParam) {
    if (this._frpcProcessListener) {
      return;
    }
    this._frpcProcessListener = setInterval(() => {
      const running = this.isRunning();
      if (!running) {
        const now = Date.now();
        const canNotify =
          this._notification === -1 ||
          now - this._notification >= DISCONNECT_NOTIFICATION_COOLDOWN_MS;
        if (this._frpcLastStartTime !== -1 && canNotify) {
          Logger.warn(
            `FrpcProcessService.watchFrpcProcess`,
            `frpc process exited unexpectedly (lastStartTime=${this._frpcLastStartTime})`
          );
          new Notification({
            title: app.getName(),
            body: "Connection lost, please check the logs for details."
          }).show();
          this._notification = now;
        }
      } else {
        this._notification = -1;
      }
      const connectionError = running ? this.readFrpcConnectionError() : null;
      const win: BrowserWindow = BeanFactory.getBean("win");
      if (win && !win.isDestroyed()) {
        win.webContents.send(
          listenerParam.channel,
          ResponseUtils.success({
            running: running,
            lastStartTime: this._frpcLastStartTime,
            connectionError,
            externalFrpc: this.getExternalFrpcStatus()
          })
        );
      }
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }
}

export default FrpcProcessService;
