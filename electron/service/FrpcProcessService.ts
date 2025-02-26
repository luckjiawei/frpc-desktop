import ServerService from "./ServerService";
import VersionRepository from "../repository/VersionRepository";
import PathUtils from "../utils/PathUtils";
import GlobalConstant from "../core/GlobalConstant";
import { app, BrowserWindow, Notification } from "electron";
import treeKill from "tree-kill";
import BeanFactory from "../core/BeanFactory";
import ResponseUtils from "../utils/ResponseUtils";
import { BusinessError, ResponseCode } from "../core/BusinessError";
import Logger from "../core/Logger";

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _versionDao: VersionRepository;
  private _frpcProcess: any;
  private _frpcProcessListener: any;
  private _frpcLastStartTime: number = -1;

  constructor(serverService: ServerService, versionDao: VersionRepository) {
    this._serverService = serverService;
    this._versionDao = versionDao;
  }

  isRunning(): boolean {
    if (!this._frpcProcess) {
      return false;
    }
    try {
      Logger.debug(
        `FrpcProcessService.isRunning`,
        `pid: ${this._frpcProcess.pid}`
      );
      process.kill(this._frpcProcess.pid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }

  async startFrpcProcess() {
    if (this.isRunning()) {
      return;
    }
    const config = await this._serverService.getServerConfig();
    if (!config) {
      throw new BusinessError(ResponseCode.NOT_CONFIG);
    }
    const version = await this._versionDao.findByGithubReleaseId(
      config.frpcVersion
    );
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);
    const command = `./${PathUtils.getFrpcFilename()} -c "${configPath}"`;
    this._frpcProcess = require("child_process").spawn(command, {
      cwd: version.localPath,
      shell: true
    });
    this._frpcLastStartTime = Date.now();
    Logger.debug(
      `FrpcProcessService.startFrpcProcess`,
      `start command: ${command}`
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
    const version = await this._versionDao.findByGithubReleaseId(
      config.frpcVersion
    );
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);
    const command = `./${PathUtils.getFrpcFilename()} reload -c "${configPath}"`;
    require("child_process").exec(
      command,
      {
        cwd: version.localPath,
        shell: true
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
        Logger.debug(
          `FrpcProcessService.reloadFrpcProcess`,
          `stderr: ${stdout}`
        );
      }
    );
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
        if (this._frpcLastStartTime !== -1) {
          new Notification({
            title: app.getName(),
            body: "Connection lost, please check the logs for details."
          }).show();
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
        ResponseUtils.success(running)
      );
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL);
  }
}

export default FrpcProcessService;
