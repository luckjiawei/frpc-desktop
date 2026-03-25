import { exec, execSync, spawn } from "child_process";
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

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _systemService: SystemService;
  private readonly _versionRepository: VersionRepository;
  private _frpcProcess: any;
  private _frpcProcessListener: any;
  private _frpcLastStartTime: number = -1;
  private _notification: number = -1;

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

  isRunning(): boolean {
    if (!this._frpcProcess) {
      // 尝试在 macOS/Linux 上探测外部已存在的 frpc 进程（应用重启后的残留进程）
      try {
        if (process.platform !== "win32") {
          const processName = PathUtils.getFrpcFilename();
          const stdout = execSync(`pgrep -x ${processName}`).toString().trim();
          if (stdout) {
            const pid = parseInt(stdout.split("\n")[0], 10);
            if (!Number.isNaN(pid)) {
              this._frpcProcess = { pid };
              if (this._frpcLastStartTime === -1) {
                this._frpcLastStartTime = Date.now();
              }
            }
          }
        } else {
          const processName = PathUtils.getWinFrpFilename();
          const stdout = execSync(
            `tasklist /FI "IMAGENAME eq ${processName}" /FO CSV`
          ).toString();
          const lines = stdout.split("\n").filter(Boolean);

          if (lines.length > 1) {
            const info = lines[1]
              .split('","')
              .map(s => s.replace(/(^"|"$)/g, ""));
            const pid = parseInt(info[1], 10);
            if (!Number.isNaN(pid)) {
              this._frpcProcess = { pid };
              if (this._frpcLastStartTime === -1) {
                this._frpcLastStartTime = Date.now();
              }
            }
          }
        }
      } catch (e) {
        // 忽略未找到进程的错误
      }

      if (!this._frpcProcess) {
        return false;
      }
    }
    try {
      process.kill(this._frpcProcess.pid, 0);
      return true;
    } catch (err: any) {
      // EPERM means process exists but we lack permission (e.g. root-owned on macOS)
      if (err.code === "EPERM") {
        return true;
      }
      return false;
    }
  }

  get frpcLastStartTime(): number {
    return this._frpcLastStartTime;
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

    this._frpcProcess = spawn(command, {
      cwd: version.localPath,
      shell: true
    });
    this._frpcLastStartTime = Date.now();
    Logger.info(
      `FrpcProcessService.startFrpcProcess`,
      `frpc started successfully, pid=${this._frpcProcess.pid}`
    );

    this._frpcProcess.stdout.on("data", data => {
      Logger.debug(`FrpcProcessService.startFrpcProcess`, `stdout: ${data}`);
    });

    this._frpcProcess.stderr.on("data", data => {
      Logger.debug(`FrpcProcessService.startFrpcProcess`, `stderr: ${data}`);
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
        this._frpcLastStartTime = -1;
        this._notification = -1;
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
          this._frpcLastStartTime = -1;
          this._notification = -1;
        }
      });
    }
  }

  async reloadFrpcProcess() {
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
    Logger.info(
      `FrpcProcessService.frpcProcessGuardian`,
      `Guardian started, interval=${GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL}s`
    );
    setInterval(async () => {
      const running = this.isRunning();
      if (!running && this._frpcLastStartTime !== -1) {
        const netStatus = await this._systemService.checkInternetConnect();
        if (netStatus) {
          this.startFrpcProcess().then(() => {
            Logger.info(
              `FrpcProcessService.frpcProcessGuardian`,
              `Network restored, frpc process restarted.`
            );
          });
        } else {
          Logger.warn(
            `FrpcProcessService.frpcProcessGuardian`,
            `frpc is not running and network is unreachable, waiting for recovery.`
          );
        }
      }
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }

  watchFrpcProcess(listenerParam: ListenerParam) {
    this._frpcProcessListener = setInterval(() => {
      const running = this.isRunning();
      if (!running) {
        if (
          this._frpcLastStartTime !== -1 &&
          this._notification !== this._frpcLastStartTime
        ) {
          Logger.warn(
            `FrpcProcessService.watchFrpcProcess`,
            `frpc process exited unexpectedly (lastStartTime=${this._frpcLastStartTime})`
          );
          new Notification({
            title: app.getName(),
            body: "Connection lost, please check the logs for details."
          }).show();
          this._notification = this._frpcLastStartTime;
        }
      }
      const win: BrowserWindow = BeanFactory.getBean("win");
      if (win && !win.isDestroyed()) {
        win.webContents.send(
          listenerParam.channel,
          ResponseUtils.success({
            running: running,
            lastStartTime: this._frpcLastStartTime
          })
        );
      }
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }
}

export default FrpcProcessService;
