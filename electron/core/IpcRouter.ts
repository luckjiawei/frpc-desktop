import ServerController from "../controller/ServerController";
import ServerDao from "../dao/ServerDao";
import ServerService from "../service/ServerService";
import LogService from "../service/LogService";
import VersionService from "../service/VersionService";
import { BrowserWindow, ipcMain } from "electron";
import LogController from "../controller/LogController";
import VersionController from "../controller/VersionController";
import FileService from "../service/FileService";
import VersionDao from "../dao/VersionDao";
import GitHubService from "../service/GitHubService";

export const ipcRouters: IpcRouters = {
  SERVER: {
    saveConfig: {
      path: "server/saveConfig",
      controller: "serverController.saveConfig"
    },
    getServerConfig: {
      path: "server/getServerConfig",
      controller: "serverController.getServerConfig"
    }
  },
  LOG: {
    getFrpLogContent: {
      path: "log/getFrpLogContent",
      controller: "logController.getFrpLogContent"
    },
    openFrpcLogFile: {
      path: "log/openFrpcLogFile",
      controller: "logController.openFrpcLogFile"
    }
  },
  VERSION: {
    getVersions: {
      path: "version/getVersions",
      controller: "versionController.getVersions"
    },
    downloadVersion: {
      path: "version/downloadVersion",
      controller: "versionController.downloadFrpVersion"
    },
    getDownloadedVersions: {
      path: "version/getDownloadedVersions",
      controller: "versionController.getDownloadedVersions"
    },
    deleteDownloadedVersion: {
      path: "version/deleteDownloadedVersion",
      controller: "versionController.deleteDownloadedVersion"
    }
  }
};

export const listeners: Listeners = {
  watchFrpcLog: {
    listenerMethod: "logService.watchFrpcLog",
    channel: "log:watchFrpcLog"
  }
};

class IpcRouterConfigurate {
  ipcRouters: Array<IpcRouter>;
  private readonly _beans: Map<string, any> = new Map<string, any>();
  private readonly _win: BrowserWindow;

  /**
   * initBeans
   * @private
   */
  private initializeBeans() {
    const serverDao = new ServerDao();
    const versionDao = new VersionDao();
    const fileService = new FileService();
    const serverService = new ServerService(serverDao);
    const gitHubService = new GitHubService();
    const versionService = new VersionService(
      versionDao,
      fileService,
      gitHubService
    );
    const logService = new LogService(fileService);
    const serverController = new ServerController(serverService);
    const versionController = new VersionController(versionService, versionDao);
    const logController = new LogController(logService);

    this._beans.set("serverDao", serverDao);
    this._beans.set("versionDao", versionDao);
    this._beans.set("fileService", fileService);
    this._beans.set("serverService", serverService);
    this._beans.set("versionService", versionService);
    this._beans.set("logService", logService);
    this._beans.set("serverController", serverController);
    this._beans.set("versionController", versionController);
    this._beans.set("logController", logController);
  }

  /**
   * initJob
   * @private
   */
  private initializeListeners() {
    Object.keys(listeners).forEach(listenerKey => {
      console.log(listenerKey, "listenerKey", listeners[listenerKey]);
      const { listenerMethod, channel } = listeners[listenerKey];
      const [beanName, method] = listenerMethod.split(".");
      const bean = this._beans.get(beanName);
      const listenerParam: ListenerParam = {
        win: this._win,
        channel: channel,
        args: []
      };
      bean[method].call(bean, listenerParam);
    });
    console.log("initialize listeners success");
    // this._beans.get("logService").watchFrpcLog(this._win);
  }

  /**
   * initRouters
   * @private
   */
  private initializeRouters() {
    Object.keys(ipcRouters).forEach(routerKey => {
      const routerGroup = ipcRouters[routerKey];

      Object.keys(routerGroup).forEach(method => {
        const router = routerGroup[method];
        ipcMain.on(router.path, (event, args) => {
          const req: ControllerParam = {
            win: this._win,
            channel: `${router.path}:hook`,
            event: event,
            args: args
          };
          const [beanName, method] = router.controller.split(".");
          const bean = this._beans.get(beanName);
          bean[method].call(bean, req);
          // bean[method].call(bean, req);
        });
      });
    });
  }

  /**
   * constructor
   * @param win mainWindows
   */
  constructor(win: BrowserWindow) {
    this._win = win;
    this.initializeBeans();
    this.initializeListeners();
    this.initializeRouters();
  }
}

export default IpcRouterConfigurate;
