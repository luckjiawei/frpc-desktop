import ServerService from "./ServerService";
import VersionDao from "../dao/VersionDao";
import PathUtils from "../utils/PathUtils";
import GlobalConstant from "../core/GlobalConstant";
import { Notification } from "electron";
import { success } from "../utils/response";
import treeKill from "tree-kill";

class FrpcProcessService {
  private readonly _serverService: ServerService;
  private readonly _versionDao: VersionDao;
  private _frpcProcess: any;
  private _frpcProcessListener: any;

  constructor(serverService: ServerService, versionDao: VersionDao) {
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
    const config = await this._serverService.getServerConfig();
    const version = await this._versionDao.findByGithubReleaseId(
      config.frpcVersion
    );
    // todo genConfigfile.
    const configPath = await this._serverService.genTomlConfig();
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
    // this._frpcProcess.on("close",function(code){
    //   console.log("out code:" + code)
    // })
  }

  async stopFrpcProcess() {
    if (this._frpcProcess) {
      treeKill(this._frpcProcess.pid, (error: Error) => {
        if (error) {
          throw error;
        } else {
          this._frpcProcess = null;
          // clearInterval(this._frpcProcessListener);
        }
      });
    } else {
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
          title: GlobalConstant.APP_NAME,
          body: "Connection lost, please check the logs for details."
        }).show();
        // logError(
        //   LogModule.FRP_CLIENT,
        //   "Frpc process status check failed. Connection lost."
        // );
        // clearInterval(this._frpcProcessListener);
      }
      listenerParam.win.webContents.send(
        listenerParam.channel,
        success(running)
      );
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL);
  }
}

export default FrpcProcessService;
