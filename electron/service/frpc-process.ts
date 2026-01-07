import "reflect-metadata";
import { exec, execSync, spawn } from "child_process";
import treeKill from "tree-kill";
import { ResponseCode } from "../core/constant";
import VersionRepository from "../repository/versions";
import NetUtils from "../utils/NetUtils";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import OpenSourceFrpcDesktopConfigService from "./OpenSourceFrpcDesktopConfigService";
import SystemService from "./system";
import log from "electron-log/main";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";
import BusinessError from "../core/error";
import FileUtils from "../utils/file";


@injectable()
class FrpcProcessService {

  @inject(TYPES.OpenSourceFrpcDesktopConfigService)
  private readonly _openSourceFrpcDesktopConfigService: OpenSourceFrpcDesktopConfigService;
  @inject(TYPES.SystemService)
  private readonly _systemService: SystemService;
  @inject(TYPES.VersionRepository)
  private readonly _versionRepository: VersionRepository;
  @inject(TYPES.Container)
  private readonly _container: Container;
  private _frpcProcess: any;
  private _frpcLastStartTime: number = -1;
  private _notification: number = -1;


  public isRunning(): boolean {
    if (!this._frpcProcess) {
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
    } catch (err) {
      return false;
    }
  }

  /**
   * get frpc last start time
   * @returns 
   */
  public getLastStartTime(): number {
    return this._frpcLastStartTime;
  }

  /**
   * start frpc process
   */
  async startFrpcProcess() {
    if (this.isRunning()) {
      return;
    }
    if (!(await this._openSourceFrpcDesktopConfigService.hasServerConfig())) {
      log.scope("frpc").warn(`startFrpcProcess failed: no server config.`);
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const config =
      await this._openSourceFrpcDesktopConfigService.getServerConfig();

    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    if (!version) {
      log.scope("frpc").warn(
        `startFrpcProcess failed: version ${config.frpcVersion} not found.`
      );
      throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
    }

    if (!FileUtils.exists(version.local_path)) {
      log.scope("frpc").warn(
        `startFrpcProcess failed: version exe file ${version.local_path} not found.`
      );
      throw new BusinessError(ResponseCode.NOT_FOUND_VERSION);
    }

    if (config.webServer.port) {
      // 检查端口是否被占用
      const isPortInUse = await NetUtils.checkPortInUse(
        config.webServer.port,
        "127.0.0.1"
      );
      if (isPortInUse) {
        log.scope("frpc").warn(
          `startFrpcProcess failed: Web Server Port ${config.webServer.port} is already in use.`
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
    log.scope("frpc").info(
      `startFrpcProcess: version ${config.frpcVersion} cwd: ${version.local_path} command: ${command}`
    );

    this._frpcProcess = spawn(command, {
      cwd: version.local_path,
      shell: true
    });
    this._frpcLastStartTime = Date.now();
    this._frpcProcess.stdout.on("data", data => {
      log.scope("frpc").info(`stdout: ${data}`);
    });

    this._frpcProcess.stderr.on("data", data => {
      log.scope("frpc").info(`stderr: ${data}`);
    });
  }

  /**
   * stop frpc process
   */
  async stopFrpcProcess() {
    if (this.isRunning()) {
      log.scope("frpc").info(`stopFrpcProcess: pid: ${this._frpcProcess.pid}`);
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

  /**
   * reload frpc process
   */
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
        cwd: version.local_path
      },
      // {
      //   cwd: version.local_path,
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

  // async frpcProcessGuardian() {
  //   setInterval(async () => {
  //     const running = this.isRunning();
  //     if (!running && this._frpcLastStartTime !== -1) {
  //       const netStatus = await this._systemService.checkInternetConnect();
  //       if (netStatus) {
  //         this.startFrpcProcess().then(() => {
  //           log.info(
  //             `FrpcProcessService.frpcProcessGuardian`,
  //             `The network has been restored. The frpc process has been restarted.`
  //           );
  //           // new Notification({
  //           //   title: app.getName(),
  //           //   body: "Network reconnected, frpc process restarted."
  //           // }).show();
  //         });
  //       }
  //     }
  //   }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  // }

  // watchFrpcProcess(listenerParam: ListenerParam) {
  //   this._frpcProcessListener = setInterval(() => {
  //     const running = this.isRunning();
  //     // todo return status to view.
  //     // logDebug(
  //     //   LogModule.FRP_CLIENT,
  //     //   `Monitoring frpc process status: ${status}, Listener ID: ${frpcStatusListener}`
  //     // );
  //     log.debug(`FrpcProcessService.watchFrpcProcess`, `running: ${running}`);
  //     if (!running) {
  //       if (
  //         this._frpcLastStartTime !== -1 &&
  //         this._notification !== this._frpcLastStartTime
  //       ) {
  //         new Notification({
  //           title: app.getName(),
  //           body: "Connection lost, please check the logs for details."
  //         }).show();
  //         this._notification = this._frpcLastStartTime;
  //       }
  //       // logError(
  //       //   LogModule.FRP_CLIENT,
  //       //   "Frpc process status check failed. Connection lost."
  //       // );
  //       // clearInterval(this._frpcProcessListener);
  //     }
  //     const win = this._container.get<BrowserWindow>(TYPES.BrowserWindow);
  //     if (win && !win.isDestroyed()) {
  //       win.webContents.send(
  //         listenerParam.channel,
  //         ResponseUtils.success({
  //           running: running,
  //           lastStartTime: this._frpcLastStartTime
  //         })
  //       );
  //     }
  //   }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  // }
}

export default FrpcProcessService;
