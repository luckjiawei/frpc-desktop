import ServerService from "./ServerService";
import VersionRepository from "../repository/VersionRepository";
import PathUtils from "../utils/PathUtils";
import GlobalConstant from "../core/GlobalConstant";
import { app, BrowserWindow, Notification } from "electron";
import { success } from "../utils/ResponseUtils";
import treeKill from "tree-kill";
import BeanFactory from "../core/BeanFactory";

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _versionDao: VersionRepository;
  private _frpcProcess: any;
  private _frpcProcessListener: any;

  constructor(serverService: ServerService, versionDao: VersionRepository) {
    this._serverService = serverService;
    this._versionDao = versionDao;
  }

  isRunning(): boolean {
    if (!this._frpcProcess) {
      return false;
    }
    try {
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
      throw new Error("请先进行配置")
    }
    const version = await this._versionDao.findByGithubReleaseId(
      config.frpcVersion
    );
    // todo genConfigfile.
    const configPath = PathUtils.getTomlConfigFilePath();
    await this._serverService.genTomlConfig(configPath);
    const command = `./${PathUtils.getFrpcFilename()} -c "${configPath}"`;
    this._frpcProcess = require("child_process").spawn(command, {
      cwd: version.localPath,
      shell: true
    });
    this._frpcProcess.stdout.on("data", data => {
      console.log(`stdout: ${data}`);
    });

    this._frpcProcess.stderr.on("data", data => {
      console.error(`stderr: ${data}`);
    });
  }

  async stopFrpcProcess() {
    if (this._frpcProcess && this.isRunning()) {
      treeKill(this._frpcProcess.pid, (error: Error) => {
        if (error) {
          throw error;
        } else {
          this._frpcProcess = null;
          // clearInterval(this._frpcProcessListener);
        }
      });
    }
  }

  watchFrpcProcess(listenerParam: ListenerParam) {
    this._frpcProcessListener = setInterval(() => {
      const running = this.isRunning();
      // todo return status to view.
      // logDebug(
      //   LogModule.FRP_CLIENT,
      //   `Monitoring frpc process status: ${status}, Listener ID: ${frpcStatusListener}`
      // );
      console.log("running", running);
      if (!running) {
        new Notification({
          title: app.getName(),
          body: "Connection lost, please check the logs for details."
        }).show();
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
