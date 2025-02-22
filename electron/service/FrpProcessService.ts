import ServerService from "./ServerService";
import VersionDao from "../dao/VersionDao";
import PathUtils from "../utils/PathUtils";
import { frpcProcess } from "../api/frpc";
import GlobalConstant from "../core/GlobalConstant";
import { Notification } from "electron";

const { exec, spawn } = require("child_process");

class FrpProcessService {
  private readonly _serverService: ServerService;
  private readonly _versionDao: VersionDao;
  private _frpcProcess: any;
  private _FrpcProcessListener: any;

  constructor(serverService: ServerService, versionDao: VersionDao) {
    this._serverService = serverService;
    this._versionDao = versionDao;
  }

  isRunning(): boolean {
    return false;
  }

  async startFrpcProcess() {
    const config = await this._serverService.getServerConfig();
    const version = await this._versionDao.findByGithubReleaseId(
      config.frpcVersion
    );
    // todo genConfigfile.
    const configPath = "";
    const command = `${PathUtils.getFrpcFilename()} -c ${configPath}`;
    this._frpcProcess = spawn(command, {
      cwd: version.localPath,
      shell: true
    });

    frpcProcess.stdout.on("data", data => {
      // logDebug(LogModule.FRP_CLIENT, `Frpc process output: ${data}`);
    });

    frpcProcess.stdout.on("error", data => {
      // logError(LogModule.FRP_CLIENT, `Frpc process error: ${data}`);
      // stopFrpcProcess(() => {});
      this.stopFrpcProcess();
    });
  }

  stopFrpcProcess() {}

  watchFrpcProcess(listenerParam: ListenerParam) {
    this._FrpcProcessListener = setInterval(() => {
      const running = this.isRunning();
      // todo return status to view.
      // logDebug(
      //   LogModule.FRP_CLIENT,
      //   `Monitoring frpc process status: ${status}, Listener ID: ${frpcStatusListener}`
      // );
      if (!running) {
        new Notification({
          title: GlobalConstant.APP_NAME,
          body: "Connection lost, please check the logs for details."
        }).show();
        // logError(
        //   LogModule.FRP_CLIENT,
        //   "Frpc process status check failed. Connection lost."
        // );
        clearInterval(this._FrpcProcessListener);
      }
    }, GlobalConstant.FRPC_PROCESS_STATUS_CHECK_INTERVAL);
  }
}

export default FrpProcessService;
