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
const MAC_HELPER_START_TIMEOUT_MS = 5000;

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _systemService: SystemService;
  private readonly _versionRepository: VersionRepository;
  private _frpcProcess: any;
  private _frpcProcesses = new Map<string, any>();
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
  private _frpcProcessSyncPromise: Promise<void> | null = null;

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

  private isPidAlive(pid: number | null | undefined) {
    if (!pid) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch (err: any) {
      return err.code === "EPERM";
    }
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
    const configDir = path.normalize(PathUtils.getConfigStoragePath());
    const defaultConfigPath = path.normalize(PathUtils.getTomlConfigFilePath());
    const fileName = path.basename(normalizedConfigPath);
    return (
      normalizedConfigPath === defaultConfigPath ||
      (path.dirname(normalizedConfigPath) === configDir &&
        /^frpc-[a-zA-Z0-9_-]+\.toml$/.test(fileName))
    );
  }

  private isServerConfigPath(configPath: string | null, serverId: string) {
    const normalizedConfigPath = this.normalizeConfigPath(configPath);
    if (!normalizedConfigPath) {
      return false;
    }
    return (
      normalizedConfigPath ===
      path.normalize(PathUtils.getTomlConfigFilePathByServerId(serverId))
    );
  }

  private isKnownManagedPid(pid: number) {
    if (
      this._frpcProcessManaged &&
      this._frpcProcess &&
      this._frpcProcess.pid === pid
    ) {
      return true;
    }
    for (const frpcProcess of this._frpcProcesses.values()) {
      if (frpcProcess?.pid === pid) {
        return true;
      }
    }
    return false;
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
    return this.listRunningFrpcProcesses().find(predicate) || null;
  }

  private listRunningFrpcProcesses(): Array<ExternalFrpcProcessInfo> {
    const processes: Array<ExternalFrpcProcessInfo> = [];
    const seenPids = new Set<number>();

    if (process.platform !== "win32") {
      for (const processName of this.getFrpcProcessNames()) {
        let stdout = "";
        try {
          stdout = execFileSync("pgrep", ["-x", processName]).toString().trim();
        } catch {
          stdout = "";
        }
        const pids = stdout
          .split("\n")
          .map(pid => parseInt(pid, 10))
          .filter(pid => !Number.isNaN(pid));
        for (const pid of pids) {
          if (seenPids.has(pid)) {
            continue;
          }
          seenPids.add(pid);
          const info = this.readExternalProcessInfo(pid, processName);
          if (info) {
            processes.push(info);
          }
        }
      }
      return processes;
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
        if (seenPids.has(pid)) {
          continue;
        }
        seenPids.add(pid);
        const externalInfo = this.readExternalProcessInfo(pid, processName);
        if (externalInfo) {
          processes.push(externalInfo);
        }
      }
    }
    return processes;
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
    if (this._frpcProcesses.size > 0) {
      let running = false;
      for (const [serverId, frpcProcess] of this._frpcProcesses) {
        try {
          process.kill(frpcProcess.pid, 0);
          running = true;
        } catch (err: any) {
          if (err.code === "EPERM") {
            running = true;
          } else {
            this._frpcProcesses.delete(serverId);
          }
        }
      }
      if (running) {
        return true;
      }
      this._frpcProcess = null;
      this._frpcProcessManaged = false;
    }
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
      const info = this.listRunningFrpcProcesses().find(info => {
        if (this.isKnownManagedPid(info.pid)) {
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
  readFrpcConnectionError(serverId = "1"): string | null {
    const logPath = PathUtils.getFrpcLogFilePathByServerId(serverId);
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

  async getServerRuntimeStatuses(): Promise<Array<FrpcServerRuntimeStatus>> {
    const servers = await this._serverService.getServerConfigs();
    const processInfos = this.listRunningFrpcProcesses();
    return servers.map(server => {
      const configPath = PathUtils.getTomlConfigFilePathByServerId(server._id);
      const logPath = PathUtils.getFrpcLogFilePathByServerId(server._id);
      const knownProcess = this._frpcProcesses.get(server._id);
      const matchedProcess = processInfos.find(info =>
        this.isServerConfigPath(info.configPath, server._id)
      );
      const knownPid = this.isPidAlive(knownProcess?.pid)
        ? knownProcess?.pid
        : null;
      const pid = matchedProcess?.pid ?? knownPid ?? null;
      const running = !!pid;
      if (matchedProcess) {
        this._frpcProcesses.set(server._id, { pid: matchedProcess.pid });
        this._frpcProcess = { pid: matchedProcess.pid };
        this._frpcProcessManaged = true;
        if (this._frpcLastStartTime === -1) {
          this._frpcLastStartTime = Date.now();
        }
      } else if (knownProcess && !knownPid) {
        this._frpcProcesses.delete(server._id);
      }

      return {
        serverId: server._id,
        name: server.name,
        remark: server.remark,
        serverAddr: server.serverAddr,
        serverPort: server.serverPort,
        isDefault: server.isDefault,
        running,
        pid,
        configPath,
        logPath,
        connectionError: running
          ? this.readFrpcConnectionError(server._id)
          : null
      };
    });
  }

  async getStatusSnapshot(forceExternal = false) {
    const serverStatuses = await this.getServerRuntimeStatuses();
    const running = this.isRunning() || serverStatuses.some(item => item.running);
    const connectionError = running
      ? serverStatuses.find(item => item.running && item.connectionError)
          ?.connectionError ?? null
      : null;
    return {
      running,
      lastStartTime: this._frpcLastStartTime,
      connectionError,
      externalFrpc: this.getExternalFrpcStatus(forceExternal),
      serverStatuses
    };
  }

  private async validateFrpcBinary(version: FrpcVersion) {
    const frpcFilename =
      process.platform === "win32"
        ? PathUtils.getWinFrpFilename()
        : PathUtils.getFrpcFilename();
    const frpcBinaryPath = path.join(version.localPath, frpcFilename);
    if (!fs.existsSync(frpcBinaryPath)) {
      Logger.warn(
        `FrpcProcessService.validateFrpcBinary`,
        `Binary not found at ${frpcBinaryPath}, removing stale DB record`
      );
      await this._versionRepository.deleteById(version._id);
      throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
    }
  }

  private async startSingleFrpcProcess(
    server: OpenSourceFrpcDesktopServer,
    version: FrpcVersion
  ) {
    await this.validateFrpcBinary(version);

    const webServerPort =
      await this._serverService.getServerRuntimeWebPort(server);
    if (webServerPort) {
      const isPortInUse = await NetUtils.checkPortInUse(
        webServerPort,
        "127.0.0.1"
      );
      if (isPortInUse) {
        Logger.warn(
          `FrpcProcessService.startSingleFrpcProcess`,
          `Web Server Port ${webServerPort} is already in use`
        );
        throw new BusinessError(ResponseCode.WEB_SERVER_PORT_IN_USE);
      }
    }

    const configPath = PathUtils.getTomlConfigFilePathByServerId(server._id);
    await this._serverService.genTomlConfig(configPath, server._id);

    Logger.debug(
      `FrpcProcessService.startSingleFrpcProcess`,
      `Config generated at: ${configPath}`
    );

    if (process.platform === "darwin") {
      if (!this.isMacHelperReady()) {
        await this.installMacHelper();
      }

      const logFilePath = PathUtils.getFrpcLogFilePathByServerId(server._id);
      if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, "", { mode: 0o644 });
      }

      const frpcBinary = path.join(
        version.localPath,
        PathUtils.getFrpcFilename()
      );
      const pidStr = await new Promise<string>(resolve => {
        exec(
          `sudo -n "${MAC_LAUNCHER_PATH}" start "${frpcBinary}" "${configPath}"`,
          { timeout: MAC_HELPER_START_TIMEOUT_MS },
          (err, stdout) => {
            if (err) {
              Logger.warn(
                `FrpcProcessService.startSingleFrpcProcess`,
                `[${server.name}] helper start did not return cleanly: ${err.message}`
              );
            }
            resolve(stdout.trim());
          }
        );
      });

      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) {
        const runningInfo = this.findRunningFrpcProcess(info =>
          this.isServerConfigPath(info.configPath, server._id)
        );
        if (runningInfo && this.isPidAlive(runningInfo.pid)) {
          Logger.info(
            `FrpcProcessService.startSingleFrpcProcess`,
            `[${server.name}] found started frpc by config scan, pid=${runningInfo.pid}`
          );
          return { pid: runningInfo.pid };
        }
        Logger.warn(
          `FrpcProcessService.startSingleFrpcProcess`,
          `frpc started but pid is invalid: "${pidStr}"`
        );
        return;
      }
      return { pid };
    }

    const command =
      process.platform === "win32"
        ? `${PathUtils.getWinFrpFilename()} -c "${configPath}"`
        : `./${PathUtils.getFrpcFilename()} -c "${configPath}"`;
    let frpcStdout = "";
    let frpcStderr = "";
    const frpcProcess = spawn(command, {
      cwd: version.localPath,
      shell: true
    });

    frpcProcess.stdout.on("data", data => {
      const message = data.toString();
      frpcStdout += message;
      Logger.debug(
        `FrpcProcessService.startSingleFrpcProcess`,
        `[${server.name}] stdout: ${message}`
      );
    });

    frpcProcess.stderr.on("data", data => {
      const message = data.toString();
      frpcStderr += message;
      Logger.warn(
        `FrpcProcessService.startSingleFrpcProcess`,
        `[${server.name}] stderr: ${message}`
      );
    });

    frpcProcess.on("error", error => {
      Logger.error(`FrpcProcessService.startSingleFrpcProcess`, error);
    });

    frpcProcess.on("exit", (code, signal) => {
      const exitMessage = [
        `[${server.name}] frpc exited, code=${code}, signal=${signal}`,
        frpcStderr.trim() ? `stderr: ${frpcStderr.trim()}` : "",
        frpcStdout.trim() ? `stdout: ${frpcStdout.trim()}` : ""
      ]
        .filter(Boolean)
        .join("\n");
      if (code && code !== 0) {
        Logger.error(
          `FrpcProcessService.startSingleFrpcProcess`,
          new Error(exitMessage)
        );
      } else {
        Logger.warn(`FrpcProcessService.startSingleFrpcProcess`, exitMessage);
      }
      this._frpcProcesses.delete(server._id);
      if (this._frpcProcess?.pid === frpcProcess.pid) {
        this._frpcProcess = this._frpcProcesses.values().next().value || null;
      }
      this._frpcProcessManaged = this._frpcProcesses.size > 0;
    });

    return frpcProcess;
  }

  async startFrpcProcess() {
    const runnableServers =
      await this._serverService.getRunnableServerConfigs();
    const validServers = runnableServers.filter(server => server?.serverAddr);
    if (validServers.length === 0) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }

    await this.syncRunnableFrpcProcesses();
  }

  async stopFrpcProcess() {
    const processes =
      this._frpcProcesses.size > 0
        ? Array.from(this._frpcProcesses.values())
        : this._frpcProcess
          ? [this._frpcProcess]
          : [];

    for (const frpcProcess of processes) {
      await this.stopSingleFrpcProcess(frpcProcess.pid, "stopFrpcProcess");
    }

    this._frpcProcesses.clear();
    this._frpcProcess = null;
    this._frpcProcessManaged = false;
    this._frpcLastStartTime = -1;
    this._notification = -1;
    this._frpcRecoveryChecking = false;
    this._frpcLastRecoveryTime = -1;
  }

  private async stopSingleFrpcProcess(pid: number, source: string) {
    Logger.info(`FrpcProcessService.${source}`, `Stopping frpc, pid=${pid}`);

    if (process.platform === "darwin") {
      try {
        await new Promise<void>((resolve, reject) => {
          exec(`sudo -n "${MAC_LAUNCHER_PATH}" stop ${pid}`, err => {
            if (err) reject(err);
            else resolve();
          });
        });
        Logger.info(
          `FrpcProcessService.${source}`,
          `frpc stopped successfully (macOS), pid=${pid}`
        );
      } catch (e) {
        Logger.error(`FrpcProcessService.${source}`, e as Error);
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      treeKill(pid, (error: Error) => {
        if (error) {
          Logger.error(`FrpcProcessService.${source}`, error);
          reject(error);
        } else {
          Logger.info(
            `FrpcProcessService.${source}`,
            `frpc stopped successfully, pid=${pid}`
          );
          resolve();
        }
      });
    });
  }

  async syncRunnableFrpcProcesses(restartRunning = true) {
    if (this._frpcProcessSyncPromise) {
      Logger.info(
        `FrpcProcessService.syncRunnableFrpcProcesses`,
        `Sync already running, reusing current task.`
      );
      return this._frpcProcessSyncPromise;
    }

    this._frpcProcessSyncPromise = this.doSyncRunnableFrpcProcesses(
      restartRunning
    ).finally(() => {
      this._frpcProcessSyncPromise = null;
    });

    return this._frpcProcessSyncPromise;
  }

  private async doSyncRunnableFrpcProcesses(restartRunning = true) {
    const allServers = await this._serverService.getServerConfigs();
    const runnableServers = (
      await this._serverService.getRunnableServerConfigs()
    ).filter(server => server?.serverAddr);
    Logger.info(
      `FrpcProcessService.syncRunnableFrpcProcesses`,
      `Runnable servers: ${
        runnableServers.map(server => server.name).join(", ") || "-"
      }`
    );
    const runnableServerIds = new Set(runnableServers.map(server => server._id));
    const runningInfos = this.listRunningFrpcProcesses().filter(info =>
      this.isAppManagedConfigPath(info.configPath)
    );

    for (const server of allServers) {
      const matchedInfo = runningInfos.find(info =>
        this.isServerConfigPath(info.configPath, server._id)
      );
      if (matchedInfo) {
        this._frpcProcesses.set(server._id, { pid: matchedInfo.pid });
        this._frpcProcess = { pid: matchedInfo.pid };
        this._frpcProcessManaged = true;
      }
    }

    for (const [serverId, frpcProcess] of Array.from(
      this._frpcProcesses.entries()
    )) {
      const pid = frpcProcess?.pid;
      if (!this.isPidAlive(pid)) {
        this._frpcProcesses.delete(serverId);
        continue;
      }
      if (!runnableServerIds.has(serverId)) {
        await this.stopSingleFrpcProcess(pid, "syncRunnableFrpcProcesses");
        this._frpcProcesses.delete(serverId);
      }
    }

    for (const info of runningInfos) {
      const matchedServer = allServers.find(server =>
        this.isServerConfigPath(info.configPath, server._id)
      );
      if (!matchedServer || runnableServerIds.has(matchedServer._id)) {
        continue;
      }
      if (!this.isPidAlive(info.pid)) {
        continue;
      }
      await this.stopSingleFrpcProcess(info.pid, "syncRunnableFrpcProcesses");
      this._frpcProcesses.delete(matchedServer._id);
    }

    const startErrors: Array<Error> = [];
    for (const server of runnableServers) {
      const currentProcess = this._frpcProcesses.get(server._id);
      if (this.isPidAlive(currentProcess?.pid)) {
        if (!restartRunning) {
          continue;
        }
        await this.stopSingleFrpcProcess(
          currentProcess.pid,
          "syncRunnableFrpcProcesses"
        );
        this._frpcProcesses.delete(server._id);
      }
      try {
        const version = await this._versionRepository.findByGithubReleaseId(
          server.frpcVersion
        );
        if (!version) {
          throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
        }
        Logger.info(
          `FrpcProcessService.syncRunnableFrpcProcesses`,
          `Starting runnable frpc. server=${server.name}, version=${version.name}`
        );
        const frpcProcess = await this.startSingleFrpcProcess(server, version);
        if (frpcProcess) {
          this._frpcProcesses.set(server._id, frpcProcess);
          this._frpcProcess = frpcProcess;
          this._frpcProcessManaged = true;
        }
      } catch (error) {
        startErrors.push(error as Error);
        Logger.error(
          `FrpcProcessService.syncRunnableFrpcProcesses [${server.name}]`,
          error as Error
        );
      }
    }

    if (this._frpcProcesses.size > 0) {
      if (this._frpcLastStartTime === -1) {
        this._frpcLastStartTime = Date.now();
      }
    } else {
      this._frpcProcess = null;
      this._frpcProcessManaged = false;
      this._frpcLastStartTime = -1;
      this._notification = -1;
    }
    this._lastExternalFrpcProbeTime = 0;
    if (this._frpcProcesses.size === 0 && startErrors.length > 0) {
      throw startErrors[0];
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
    Logger.info(
      `FrpcProcessService.reloadFrpcProcess`,
      `Restarting managed frpc processes for updated server/proxy config`
    );
    await this.stopFrpcProcess();
    await this.startFrpcProcess();
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
      this.getStatusSnapshot()
        .then(status => {
          const win: BrowserWindow = BeanFactory.getBean("win");
          if (win && !win.isDestroyed()) {
            win.webContents.send(
              listenerParam.channel,
              ResponseUtils.success(status)
            );
          }
        })
        .catch(error => {
          Logger.error(`FrpcProcessService.watchFrpcProcess`, error as Error);
        });
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }
}

export default FrpcProcessService;
