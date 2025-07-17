import { exec, spawn } from "child_process";
import { app, BrowserWindow, Notification } from "electron";
import treeKill from "tree-kill";
import BeanFactory from "../core/BeanFactory";
import { BusinessError, ResponseCode } from "../core/BusinessError";
import GlobalConstant from "../core/GlobalConstant";
import Logger from "../core/Logger";
import VersionRepository from "../repository/VersionRepository";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import ServerService from "./ServerService";
import SystemService from "./SystemService";
import ManyServerService from "./ManyServerService";

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _systemService: SystemService;
  private readonly _versionRepository: VersionRepository;
  private readonly _manyServerService: ManyServerService;
  private _frpcProcess: Map<string, any> = new Map();
  private _frpcProcessListener: Map<string, any> = new Map();
  private _frpcLastStartTime: number = -1;
  private _notification: number = -1;

  constructor() {
    this._serverService = BeanFactory.getBean("serverService");
    this._systemService = BeanFactory.getBean("systemService");
    this._versionRepository = BeanFactory.getBean("versionRepository");
  }

  isRunning(): boolean {
    // 检查所有frpc进程是否都在线
    if (this._frpcProcess.size === 0) {
      return false;
    }

    for (const [serverId, process] of this._frpcProcess.entries()) {
      try {
        if (!process || !process.pid) {
          return false;
        }
        process.kill(0); // 检查进程是否存在
      } catch (err) {
        return false; // 任何一个进程不存在，返回false
      }
    }

    return true; // 所有进程都在线
  }

  get frpcLastStartTime(): number {
    return this._frpcLastStartTime;
  }

  async startFrpcProcess() {
    if (this.isRunning()) {
      return;
    }
    if (!(await this._serverService.hasServerConfig())) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const config = await this._serverService.getServerConfig();

    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);
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
    Logger.debug(
      `FrpcProcessService.startFrpcProcess`,
      `start frpc cwd: ${version.localPath} command: ${command}`
    );
    this._frpcProcess.stdout.on("data", data => {
      Logger.debug(`FrpcProcessService.startFrpcProcess`, `stdout: ${data}`);
    });

    this._frpcProcess.stderr.on("data", data => {
      Logger.debug(`FrpcProcessService.startFrpcProcess`, `stderr: ${data}`);
    });
  }

  async startSingleFrpcProcess(serverId: string) {
    if (this._frpcProcess.has(serverId)) {
      return;
    }
    const config = await this._manyServerService.(serverId);
    
  }

  async stopFrpcProcess() {
    if (this._frpcProcess && this.isRunning()) {
      Logger.debug(
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
    const config = await this._serverService.getServerConfig();
    if (!config) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const version = await this._versionRepository.findByGithubReleaseId(
      config.frpcVersion
    );
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);
    const command = `./${PathUtils.getFrpcFilename()} reload -c "${configPath}"`;
    exec(
      command,
      // {
      //   cwd: version.localPath,
      //   shell: true
      // },
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
        Logger.debug(
          `FrpcProcessService.reloadFrpcProcess`,
          `stderr: ${stdout}`
        );
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
            Logger.info(
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
      Logger.debug(
        `FrpcProcessService.watchFrpcProcess`,
        `running: ${running}`
      );
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
      const win: BrowserWindow = BeanFactory.getBean("win");
      win.webContents.send(
        listenerParam.channel,
        ResponseUtils.success({
          running: running,
          lastStartTime: this._frpcLastStartTime
        })
      );
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL * 1000);
  }
}

export default FrpcProcessService;
