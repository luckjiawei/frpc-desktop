import ServerController from "../controller/ServerController";
import ServerDao from "../dao/ServerDao";
import ServerService from "../service/ServerService";
import LogService from "../service/LogService";
import { BrowserWindow, ipcMain } from "electron";
import LogController from "../controller/LogController";
import FileService from "../service/FileService";

type IpcRouter = {
  path: string;
  reply: string;
  controller: any;
  instance: any;
};

class IpcRouterConfigurate {
  ipcRouters: Array<IpcRouter>;
  private readonly _win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this._win = win;
    const serverDao = new ServerDao();
    const fileService = new FileService();
    const serverService = new ServerService(serverDao);
    const logService = new LogService(fileService);
    const serverController = new ServerController(serverService);
    const logController = new LogController(logService);

    logService.watchFrpcLog(win);

    this.ipcRouters = [
      {
        path: "server/test",
        reply: "server/test.hook",
        controller: serverController.saveConfig,
        instance: serverController
      },
      {
        path: "log/getFrpLogContent",
        reply: "log/getFrpLogContent.hook",
        controller: logController.getFrpLogContent,
        instance: logController
      },
      // {
      //   path: "log/watchFrpcLogContent",
      //   reply: "log/watchFrpcLogContent.hook",
      //   controller: logController.watchFrpcLogContent,
      //   instance: logController
      // },
      {
        path: "log/openFrpcLogFile",
        reply: "log/openFrpcLogFile.hook",
        controller: logController.openFrpcLogFile,
        instance: logController
      }
    ];
  }

  init() {
    this.ipcRouters.forEach(router => {
      ipcMain.on(router.path, (event, args) => {
        const req: ControllerRequest = {
          win: this._win,
          reply: router.reply,
          event: event,
          args: args
        };
        router.controller.call(router.instance, req);
      });
    });
    console.log("ipcRouter init success.");
  }
}

export default IpcRouterConfigurate;
