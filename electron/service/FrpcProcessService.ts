import { exec, execFile, spawn } from "child_process";
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
const FRPC_RECOVERY_BACKOFF_MS = [5000, 10000, 30000, 60000];
const FRPC_LOG_WATCH_DEBOUNCE_MS = 400;
const FRPC_LOG_INITIAL_READ_SIZE = 8192;
const FRPC_LOG_READ_CHUNK_SIZE = 64 * 1024;
const FRPC_PROCESS_OUTPUT_TAIL_SIZE = 8192;

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _systemService: SystemService;
  private readonly _versionRepository: VersionRepository;
  private _frpcProcess: any;
  private _frpcProcessListener: NodeJS.Timeout | null = null;
  private _frpcProcessListenerParam: ListenerParam | null = null;
  private _frpcLastStartTime: number = -1;
  private _notification: number = -1;
  private _frpcMonitorRunning = false;
  private _frpcRecoveryAttempt = 0;
  private _frpcNextRecoveryTime = -1;
  private _disposed = false;
  private _stoppingPromise: Promise<void> | null = null;
  private _existingProcessRestorePromise: Promise<void> | null = null;
  private _existingProcessRestoreCompleted = false;
  private _connectionError: string | null = null;
  private _frpcLogWatcher: fs.FSWatcher | null = null;
  private _frpcLogWatchTimer: NodeJS.Timeout | null = null;
  private _frpcLogReadOffset = 0;
  private _frpcLogReadRunning = false;
  private _frpcLogReadPending = false;
  private _frpcLogBuffers = {
    stdout: "",
    stderr: "",
    file: ""
  };
  private _lastSentRunning: boolean | null = null;
  private _lastSentConnectionError: string | null | undefined;
  private _lastSentStartTime = -1;

  constructor() {
    this._serverService = BeanFactory.getBean("serverService");
    this._systemService = BeanFactory.getBean("systemService");
    this._versionRepository = BeanFactory.getBean("versionRepository");
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

  private findExistingProcessPid(): Promise<number | null> {
    const processName =
      process.platform === "win32"
        ? PathUtils.getWinFrpFilename()
        : PathUtils.getFrpcFilename();
    const command = process.platform === "win32" ? "tasklist" : "pgrep";
    const args =
      process.platform === "win32"
        ? ["/FI", `IMAGENAME eq ${processName}`, "/FO", "CSV", "/NH"]
        : ["-x", processName];

    return new Promise(resolve => {
      execFile(command, args, { windowsHide: true }, (error, stdout) => {
        if (error) {
          if (!(process.platform !== "win32" && error.code === 1)) {
            Logger.warn(
              `FrpcProcessService.findExistingProcessPid`,
              `Unable to inspect existing frpc processes: ${error.message}`
            );
          }
          resolve(null);
          return;
        }

        const pid =
          process.platform === "win32"
            ? stdout
                .split(/\r?\n/)
                .map(line => line.match(/^"[^"]+","(\d+)"/))
                .find(Boolean)?.[1]
            : stdout
                .split(/\r?\n/)
                .map(line => line.trim())
                .find(line => /^\d+$/.test(line));
        const parsedPid = Number(pid);
        resolve(
          Number.isInteger(parsedPid) && parsedPid > 0 ? parsedPid : null
        );
      });
    });
  }

  async restoreExistingProcess(): Promise<void> {
    if (this._existingProcessRestoreCompleted || this._frpcProcess) {
      return;
    }
    if (this._existingProcessRestorePromise) {
      return this._existingProcessRestorePromise;
    }

    this._existingProcessRestorePromise = (async () => {
      const pid = await this.findExistingProcessPid();
      if (pid && !this._frpcProcess) {
        this._frpcProcess = { pid };
        this._frpcLastStartTime = Date.now();
        this._connectionError = null;
        this.resetRecoveryBackoff();
        await this.startLogFileWatcher(true);
        Logger.info(
          `FrpcProcessService.restoreExistingProcess`,
          `Existing frpc process restored, pid=${pid}`
        );
        this.sendProcessStatus(true, true);
      }
    })().finally(() => {
      this._existingProcessRestoreCompleted = true;
      this._existingProcessRestorePromise = null;
    });

    return this._existingProcessRestorePromise;
  }

  isRunning(): boolean {
    if (!this._frpcProcess) {
      return false;
    }
    return this.isProcessAlive(Number(this._frpcProcess.pid));
  }

  get frpcLastStartTime(): number {
    return this._frpcLastStartTime;
  }

  get frpcConnectionError(): string | null {
    return this._connectionError;
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error: any) {
      return error.code === "EPERM";
    }
  }

  private resetProcessState(pid: number): void {
    if (this._frpcProcess?.pid === pid) {
      this._frpcProcess = null;
    }
    if (!this._frpcProcess) {
      this._frpcLastStartTime = -1;
      this._notification = -1;
      this.updateConnectionError(null);
      this.stopLogFileWatcher();
      this.resetRecoveryBackoff();
      this.sendProcessStatus(false);
    }
  }

  private resetRecoveryBackoff(): void {
    this._frpcRecoveryAttempt = 0;
    this._frpcNextRecoveryTime = -1;
  }

  private scheduleRecoveryRetry(): void {
    const backoffIndex = Math.min(
      this._frpcRecoveryAttempt,
      FRPC_RECOVERY_BACKOFF_MS.length - 1
    );
    const delay = FRPC_RECOVERY_BACKOFF_MS[backoffIndex];
    this._frpcRecoveryAttempt++;
    this._frpcNextRecoveryTime = Date.now() + delay;
    Logger.info(
      `FrpcProcessService.scheduleRecoveryRetry`,
      `Next frpc recovery attempt in ${delay / 1000}s`
    );
  }

  private terminateWindowsProcess(pid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const taskkill = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        shell: false,
        stdio: "ignore",
        windowsHide: true
      });

      taskkill.once("error", reject);
      taskkill.once("close", code => {
        if (code === 0 || !this.isProcessAlive(pid)) {
          resolve();
          return;
        }
        reject(new Error(`taskkill failed for pid=${pid}, exitCode=${code}`));
      });
    });
  }

  private terminateProcessTree(pid: number): Promise<void> {
    if (process.platform === "win32") {
      return this.terminateWindowsProcess(pid);
    }
    return new Promise((resolve, reject) => {
      treeKill(pid, (error: Error) => {
        if (!error || !this.isProcessAlive(pid)) {
          resolve();
          return;
        }
        reject(error);
      });
    });
  }

  private async launchMacFrpc(
    frpcBinary: string,
    configPath: string
  ): Promise<number> {
    const pidFilePath = path.join(
      app.getPath("temp"),
      `frpc-desktop-${process.pid}-${Date.now()}.pid`
    );
    let pidFile: fs.promises.FileHandle | null = null;

    try {
      pidFile = await fs.promises.open(pidFilePath, "w", 0o600);
      await new Promise<void>((resolve, reject) => {
        const launcher = spawn(
          "sudo",
          ["-n", MAC_LAUNCHER_PATH, "start", frpcBinary, configPath],
          {
            shell: false,
            stdio: ["ignore", pidFile.fd, "ignore"],
            windowsHide: true
          }
        );
        launcher.once("error", reject);
        launcher.once("close", code => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`macOS frpc launcher exited with code ${code}`));
        });
      });

      await pidFile.close();
      pidFile = null;
      const pid = Number.parseInt(
        (await fs.promises.readFile(pidFilePath, "utf8")).trim(),
        10
      );
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new Error(`macOS frpc launcher returned an invalid pid: ${pid}`);
      }
      return pid;
    } finally {
      await pidFile?.close();
      await fs.promises.rm(pidFilePath, { force: true });
    }
  }

  private updateConnectionError(connectionError: string | null): void {
    if (this._connectionError === connectionError) {
      return;
    }
    this._connectionError = connectionError;
    this.sendProcessStatus(this.isRunning());
  }

  private processLogLine(line: string): void {
    if (FRPC_SUCCESS_PATTERNS.some(pattern => line.includes(pattern))) {
      this.updateConnectionError(null);
      return;
    }
    const errorPattern = FRPC_ERROR_PATTERNS.find(pattern =>
      line.includes(pattern)
    );
    if (!errorPattern) {
      return;
    }
    const match = line.match(new RegExp(`${errorPattern}.*`));
    this.updateConnectionError(match ? match[0].trim() : line.trim());
  }

  private processLogOutput(
    source: keyof typeof this._frpcLogBuffers,
    output: string
  ): void {
    const lines = `${this._frpcLogBuffers[source]}${output}`.split(/\r?\n/);
    this._frpcLogBuffers[source] = lines.pop() ?? "";
    lines.forEach(line => this.processLogLine(line));
    // Streams and file writes are not required to end with a newline. Parse a
    // complete status marker in the trailing fragment immediately; a later
    // chunk may parse it again, but updateConnectionError de-duplicates it.
    this.processLogLine(this._frpcLogBuffers[source]);
  }

  private appendProcessOutputTail(current: string, output: string): string {
    return `${current}${output}`.slice(-FRPC_PROCESS_OUTPUT_TAIL_SIZE);
  }

  private scheduleIncrementalLogRead(): void {
    if (this._frpcLogWatchTimer) {
      clearTimeout(this._frpcLogWatchTimer);
    }
    this._frpcLogWatchTimer = setTimeout(() => {
      this._frpcLogWatchTimer = null;
      void this.readIncrementalLogChanges();
    }, FRPC_LOG_WATCH_DEBOUNCE_MS);
  }

  private async readIncrementalLogChanges(): Promise<void> {
    if (this._frpcLogReadRunning) {
      this._frpcLogReadPending = true;
      return;
    }
    this._frpcLogReadRunning = true;
    try {
      const logPath = PathUtils.getFrpcLogFilePath();
      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(logPath);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          this._frpcLogReadOffset = 0;
          this._frpcLogBuffers.file = "";
          return;
        }
        throw error;
      }

      if (stat.size < this._frpcLogReadOffset) {
        this._frpcLogReadOffset = 0;
        this._frpcLogBuffers.file = "";
      }
      if (stat.size === this._frpcLogReadOffset) {
        return;
      }

      const handle = await fs.promises.open(logPath, "r");
      try {
        while (this._frpcLogReadOffset < stat.size) {
          const readSize = Math.min(
            FRPC_LOG_READ_CHUNK_SIZE,
            stat.size - this._frpcLogReadOffset
          );
          const buffer = Buffer.allocUnsafe(readSize);
          const { bytesRead } = await handle.read(
            buffer,
            0,
            readSize,
            this._frpcLogReadOffset
          );
          if (bytesRead === 0) {
            break;
          }
          this._frpcLogReadOffset += bytesRead;
          this.processLogOutput("file", buffer.toString("utf8", 0, bytesRead));
        }
      } finally {
        await handle.close();
      }
    } catch (error) {
      Logger.warn(
        "FrpcProcessService.readIncrementalLogChanges",
        `Unable to read frpc log changes: ${(error as Error).message}`
      );
    } finally {
      this._frpcLogReadRunning = false;
      if (this._frpcLogReadPending) {
        this._frpcLogReadPending = false;
        this.scheduleIncrementalLogRead();
      }
    }
  }

  private async startLogFileWatcher(readExistingTail: boolean): Promise<void> {
    this.stopLogFileWatcher();
    const logPath = PathUtils.getFrpcLogFilePath();
    const logDirectory = path.dirname(logPath);
    const logFilename = path.basename(logPath);
    await fs.promises.mkdir(logDirectory, { recursive: true });

    try {
      const stat = await fs.promises.stat(logPath);
      this._frpcLogReadOffset = readExistingTail
        ? Math.max(0, stat.size - FRPC_LOG_INITIAL_READ_SIZE)
        : stat.size;
      if (readExistingTail && this._frpcLogReadOffset > 0) {
        this._frpcLogBuffers.file = "";
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      this._frpcLogReadOffset = 0;
    }

    this._frpcLogWatcher = fs.watch(logDirectory, (eventType, filename) => {
      if (!filename || filename.toString() === logFilename) {
        if (eventType === "rename") {
          this._frpcLogReadOffset = 0;
          this._frpcLogBuffers.file = "";
        }
        this.scheduleIncrementalLogRead();
      }
    });
    this._frpcLogWatcher.on("error", error => {
      Logger.warn(
        "FrpcProcessService.startLogFileWatcher",
        `frpc log watcher stopped: ${error.message}`
      );
      this._frpcLogWatcher?.close();
      this._frpcLogWatcher = null;
    });

    if (readExistingTail) {
      await this.readIncrementalLogChanges();
    }
  }

  private stopLogFileWatcher(): void {
    this._frpcLogWatcher?.close();
    this._frpcLogWatcher = null;
    if (this._frpcLogWatchTimer) {
      clearTimeout(this._frpcLogWatchTimer);
      this._frpcLogWatchTimer = null;
    }
    this._frpcLogReadOffset = 0;
    this._frpcLogReadPending = false;
    this._frpcLogBuffers = { stdout: "", stderr: "", file: "" };
  }

  async startFrpcProcess() {
    await this.restoreExistingProcess();
    if (this._disposed) {
      return;
    }
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
    if (this._disposed) {
      return;
    }

    Logger.debug(
      `FrpcProcessService.startFrpcProcess`,
      `Config generated at: ${configPath}`
    );
    this._connectionError = null;
    await this.startLogFileWatcher(false);

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

      // Redirect launcher output to a regular file so the background frpc process
      // cannot keep a Node.js stdout pipe open and delay PID delivery.
      const pid = await this.launchMacFrpc(frpcBinary, configPath);
      this._frpcProcess = { pid };
      this.resetRecoveryBackoff();
      this._frpcLastStartTime = Date.now();
      Logger.info(
        `FrpcProcessService.startFrpcProcess`,
        `frpc started successfully (macOS), pid=${pid}`
      );
      this.sendProcessStatus(true, true);
      return;
    }

    let frpcStdout = "";
    let frpcStderr = "";
    const frpcProcess = spawn(frpcBinaryPath, ["-c", configPath], {
      cwd: version.localPath,
      shell: false,
      windowsHide: true
    });
    this._frpcProcess = frpcProcess;
    this._frpcLastStartTime = Date.now();
    this.resetRecoveryBackoff();
    Logger.info(
      `FrpcProcessService.startFrpcProcess`,
      `frpc started successfully, pid=${this._frpcProcess.pid}`
    );

    frpcProcess.stdout.on("data", data => {
      const message = data.toString();
      frpcStdout = this.appendProcessOutputTail(frpcStdout, message);
      this.processLogOutput("stdout", message);
      Logger.debug(`FrpcProcessService.startFrpcProcess`, `stdout: ${message}`);
    });

    frpcProcess.stderr.on("data", data => {
      const message = data.toString();
      frpcStderr = this.appendProcessOutputTail(frpcStderr, message);
      this.processLogOutput("stderr", message);
      Logger.warn(`FrpcProcessService.startFrpcProcess`, `stderr: ${message}`);
    });

    frpcProcess.on("error", error => {
      Logger.error(`FrpcProcessService.startFrpcProcess`, error);
    });

    frpcProcess.on("exit", (code, signal) => {
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
      if (this._frpcProcess === frpcProcess) {
        this._frpcProcess = null;
        this.updateConnectionError(null);
        this.sendProcessStatus(false);
      }
    });
    this.sendProcessStatus(true, true);
  }

  async stopFrpcProcess(): Promise<void> {
    await this.restoreExistingProcess();
    if (this._stoppingPromise) {
      return this._stoppingPromise;
    }

    if (!this._frpcProcess) {
      return;
    }

    const pid = Number(this._frpcProcess.pid);
    if (!Number.isInteger(pid) || pid <= 0) {
      Logger.warn(
        `FrpcProcessService.stopFrpcProcess`,
        `Skipping stop because pid is invalid: ${this._frpcProcess.pid}`
      );
      this._frpcProcess = null;
      this.resetProcessState(pid);
      return;
    }

    if (!this.isProcessAlive(pid)) {
      Logger.info(
        `FrpcProcessService.stopFrpcProcess`,
        `frpc is already stopped, pid=${pid}`
      );
      this.resetProcessState(pid);
      return;
    }

    this._stoppingPromise = (async () => {
      Logger.info(
        `FrpcProcessService.stopFrpcProcess`,
        `Stopping frpc, pid=${pid}`
      );

      try {
        if (process.platform === "darwin") {
          // macOS: frpc runs as root; use the privileged helper to kill it
          await new Promise<void>((resolve, reject) => {
            exec(`sudo -n "${MAC_LAUNCHER_PATH}" stop ${pid}`, err => {
              if (err) reject(err);
              else resolve();
            });
          });
        } else {
          await this.terminateProcessTree(pid);
        }

        Logger.info(
          `FrpcProcessService.stopFrpcProcess`,
          `frpc stopped successfully, pid=${pid}`
        );
        this.resetProcessState(pid);
      } catch (error) {
        if (!this.isProcessAlive(pid)) {
          Logger.info(
            `FrpcProcessService.stopFrpcProcess`,
            `frpc exited before termination completed, pid=${pid}`
          );
          this.resetProcessState(pid);
          return;
        }

        Logger.error(`FrpcProcessService.stopFrpcProcess`, error as Error);
        throw error;
      } finally {
        this._stoppingPromise = null;
      }
    })();

    return this._stoppingPromise;
  }

  async reloadFrpcProcess() {
    await this.restoreExistingProcess();
    if (!this.isRunning()) {
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
    const frpcFilename =
      process.platform === "win32"
        ? PathUtils.getWinFrpFilename()
        : PathUtils.getFrpcFilename();
    const frpcBinaryPath = path.join(version.localPath, frpcFilename);
    Logger.info(
      `FrpcProcessService.reloadFrpcProcess`,
      `Reloading frpc config, pid=${this._frpcProcess?.pid}`
    );
    await new Promise<void>((resolve, reject) => {
      execFile(
        frpcBinaryPath,
        ["reload", "-c", configPath],
        {
          cwd: version.localPath,
          windowsHide: true
        },
        (error, stdout, stderr) => {
          if (error) {
            Logger.error(`FrpcProcessService.reloadFrpcProcess`, error);
            reject(error);
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
          resolve();
        }
      );
    });
  }

  private sendProcessStatus(
    running: boolean,
    includeLastStartTime = false
  ): void {
    if (!this._frpcProcessListenerParam) {
      return;
    }
    const connectionError = running ? this._connectionError : null;
    const statusChanged =
      this._lastSentRunning !== running ||
      this._lastSentConnectionError !== connectionError;
    const startTimeChanged =
      includeLastStartTime &&
      this._lastSentStartTime !== this._frpcLastStartTime;
    if (!statusChanged && !startTimeChanged) {
      return;
    }
    const status: FrpcProcessStatus = { running, connectionError };
    if (startTimeChanged) {
      status.lastStartTime = this._frpcLastStartTime;
    }
    const win: BrowserWindow = BeanFactory.getBean("win");
    if (win && !win.isDestroyed()) {
      win.webContents.send(
        this._frpcProcessListenerParam.channel,
        ResponseUtils.success(status)
      );
      this._lastSentRunning = running;
      this._lastSentConnectionError = connectionError;
      if (status.lastStartTime !== undefined) {
        this._lastSentStartTime = status.lastStartTime;
      }
    }
  }

  private notifyUnexpectedExit(): void {
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
  }

  private async attemptProcessRecovery(): Promise<void> {
    if (
      this._disposed ||
      this._stoppingPromise ||
      this._frpcLastStartTime === -1 ||
      (this._frpcNextRecoveryTime !== -1 &&
        Date.now() < this._frpcNextRecoveryTime)
    ) {
      return;
    }

    try {
      const netStatus = await this._systemService.checkInternetConnect();
      if (this._disposed || this._stoppingPromise) {
        return;
      }
      if (!netStatus) {
        Logger.warn(
          `FrpcProcessService.attemptProcessRecovery`,
          `frpc is not running and network is unreachable, waiting for recovery.`
        );
        this.scheduleRecoveryRetry();
        return;
      }

      await this.startFrpcProcess();
      if (this._disposed) {
        return;
      }
      if (this.isRunning()) {
        this.resetRecoveryBackoff();
        Logger.info(
          `FrpcProcessService.attemptProcessRecovery`,
          `Network restored, frpc process restarted.`
        );
      } else {
        this.scheduleRecoveryRetry();
      }
    } catch (error) {
      Logger.error(`FrpcProcessService.attemptProcessRecovery`, error as Error);
      this.scheduleRecoveryRetry();
    }
  }

  private async monitorFrpcProcess(): Promise<void> {
    if (this._disposed || this._frpcMonitorRunning) {
      return;
    }
    this._frpcMonitorRunning = true;
    try {
      const running = this.isRunning();
      if (running) {
        this._notification = -1;
        this.resetRecoveryBackoff();
        // fs.watch is best-effort and may coalesce or drop events, especially
        // when macOS frpc writes as root. The offset check is asynchronous and
        // reads nothing when the file has not grown.
        await this.readIncrementalLogChanges();
      } else {
        this.notifyUnexpectedExit();
      }
      this.sendProcessStatus(running);
      if (!running) {
        await this.attemptProcessRecovery();
      }
    } finally {
      this._frpcMonitorRunning = false;
    }
  }

  watchFrpcProcess(listenerParam: ListenerParam): void {
    this._frpcProcessListenerParam = listenerParam;
    if (this._frpcProcessListener) {
      return;
    }
    Logger.info(
      `FrpcProcessService.watchFrpcProcess`,
      `Process monitor started, interval=${GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL}s`
    );
    void this.monitorFrpcProcess();
    this._frpcProcessListener = setInterval(() => {
      void this.monitorFrpcProcess();
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }

  dispose(): void {
    this._disposed = true;
    if (this._frpcProcessListener) {
      clearInterval(this._frpcProcessListener);
      this._frpcProcessListener = null;
    }
    this.stopLogFileWatcher();
    this._frpcProcessListenerParam = null;
  }
}

export default FrpcProcessService;
