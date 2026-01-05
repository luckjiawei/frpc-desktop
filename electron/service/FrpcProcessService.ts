import "reflect-metadata";
import { exec, execSync, spawn } from "child_process";
import { app, BrowserWindow, Notification } from "electron";
import treeKill from "tree-kill";
import { ResponseCode } from "../core/constant";
import VersionRepository from "../repository/VersionRepository";
import NetUtils from "../utils/NetUtils";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import OpenSourceFrpcDesktopConfigService from "./OpenSourceFrpcDesktopConfigService";
import SystemService from "./SystemService";
import log from "electron-log/main";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";
import BusinessError from "../core/error";
import { GlobalConstant } from "../core/constant";

@injectable()
class FrpcProcessService {
  private readonly _openSourceFrpcDesktopConfigService: OpenSourceFrpcDesktopConfigService;
  private readonly _systemService: SystemService;
  private readonly _versionRepository: VersionRepository;
  private readonly _container: Container;
  private _frpcProcess: any;
  private _frpcProcessListener: any;
  private _frpcLastStartTime: number = -1;
  private _notification: number = -1;

  constructor(
    @inject(TYPES.OpenSourceFrpcDesktopConfigService) openSourceFrpcDesktopConfigService: OpenSourceFrpcDesktopConfigService,
    @inject(TYPES.SystemService) systemService: SystemService,
    @inject(TYPES.VersionRepository) versionRepository: VersionRepository,
    @inject(TYPES.Container) container: Container
  ) {
    this._openSourceFrpcDesktopConfigService = openSourceFrpcDesktopConfigService;
    this._systemService = systemService;
    this._versionRepository = versionRepository;
    this._container = container;
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
      log.debug(
        `FrpcProcessService.isRunning`,
        `pid: ${this._frpcProcess.pid}`
      );
      process.kill(this._frpcProcess.pid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }

  async getLastStartTime(): Promise<number> {
    return this._frpcLastStartTime;
  }

  async startFrpcProcess() {
    if (this.isRunning()) {
      return;
    }
    if (!(await this._openSourceFrpcDesktopConfigService.hasServerConfig())) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const config =
      await this._openSourceFrpcDesktopConfigService.getServerConfig();

    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    if (!version) {
      throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
    }

    if (config.webServer.port) {
      // 检查端口是否被占用
      const isPortInUse = await NetUtils.checkPortInUse(
        config.webServer.port,
        "127.0.0.1"
      );
      if (isPortInUse) {
        log.warn(
          `FrpcProcessService.startFrpcProcess`,
          `Web Server Port ${config.webServer.port} is already in use`
        );
        throw new BusinessError(ResponseCode.WEB_SERVER_PORT_IN_USE);
      }
    }

    const configPath = PathUtils.getTomlConfigFilePath();
    await this._openSourceFrpcDesktopConfigService.genTomlConfig(configPath);
    let command = "";
    if (process.platform === "win32") {
      command = `${PathUtils.getWinFrpFilename()} -c "${configPath}"`;
    } else {
      command = `./${PathUtils.getFrpcFilename()} -c "${configPath}"`;
    }
    log.debug(
      `FrpcProcessService.startFrpcProcess`,
      `version: ${version} cwd: ${version?.localPath} command: ${command}`
    );

    this._frpcProcess = spawn(command, {
      cwd: version.localPath,
      shell: true
    });
    this._frpcLastStartTime = Date.now();
    // log.debug(
    //   `FrpcProcessService.startFrpcProcess`,
    //   `start frpc cwd: ${version.localPath} command: ${command}`
    // );
    this._frpcProcess.stdout.on("data", data => {
      log.debug(`FrpcProcessService.startFrpcProcess`, `stdout: ${data}`);
    });

    this._frpcProcess.stderr.on("data", data => {
      log.debug(`FrpcProcessService.startFrpcProcess`, `stderr: ${data}`);
    });
  }

  async stopFrpcProcess() {
    if (this._frpcProcess && this.isRunning()) {
      log.debug(
        `FrpcProcessService.stopFrpcProcess`,
        `pid: ${this._frpcProcess.pid}`
      );
      treeKill(this._frpcProcess.pid, (error: Error) => {
        if (error) {
          throw error;
        } else {
          this._frpcProcess = null;
          this._frpcLastStartTime = -1;
          this._notification = -1;
          // clearInterval(this._frpcProcessListener);
        }
      });
    }
  }

  async reloadFrpcProcess() {
    if (!this.isRunning()) {
      return;
    }
    const config =
      await this._openSourceFrpcDesktopConfigService.getServerConfig();
    if (!config) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._openSourceFrpcDesktopConfigService.genTomlConfig(configPath);
    let command = "";
    if (process.platform === "win32") {
      command = `${PathUtils.getWinFrpFilename()} reload -c "${configPath}"`;
    } else {
      command = `./${PathUtils.getFrpcFilename()} reload -c "${configPath}"`;
    }
    exec(
      command,
      {
        cwd: version.localPath
      },
      // {
      //   cwd: version.localPath,
      //   shell: true
      // },
      (error, stdout, stderr) => {
        if (error) {
          log.error(`FrpcProcessService.reloadFrpcProcess`, error);
          return;
        }
        if (stderr) {
          log.debug(
            `FrpcProcessService.reloadFrpcProcess`,
            `stderr: ${stderr}`
          );
        }
        log.debug(`FrpcProcessService.reloadFrpcProcess`, `stderr: ${stdout}`);
      }
    );
  }

  async frpcProcessGuardian() {
    setInterval(async () => {
      const running = this.isRunning();
      if (!running && this._frpcLastStartTime !== -1) {
        const netStatus = await this._systemService.checkInternetConnect();
        if (netStatus) {
          this.startFrpcProcess().then(() => {
            log.info(
              `FrpcProcessService.frpcProcessGuardian`,
              `The network has been restored. The frpc process has been restarted.`
            );
            // new Notification({
            //   title: app.getName(),
            //   body: "Network reconnected, frpc process restarted."
            // }).show();
          });
        }
      }
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }

  watchFrpcProcess(listenerParam: ListenerParam) {
    this._frpcProcessListener = setInterval(() => {
      const running = this.isRunning();
      // todo return status to view.
      // logDebug(
      //   LogModule.FRP_CLIENT,
      //   `Monitoring frpc process status: ${status}, Listener ID: ${frpcStatusListener}`
      // );
      log.debug(`FrpcProcessService.watchFrpcProcess`, `running: ${running}`);
      if (!running) {
        if (
          this._frpcLastStartTime !== -1 &&
          this._notification !== this._frpcLastStartTime
        ) {
          new Notification({
            title: app.getName(),
            body: "Connection lost, please check the logs for details."
          }).show();
          this._notification = this._frpcLastStartTime;
        }
        // logError(
        //   LogModule.FRP_CLIENT,
        //   "Frpc process status check failed. Connection lost."
        // );
        // clearInterval(this._frpcProcessListener);
      }
      const win = this._container.get<BrowserWindow>(TYPES.BrowserWindow);
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
