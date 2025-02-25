import SystemService from "../service/SystemService";
import ResponseUtils from "../utils/ResponseUtils";
import PathUtils from "../utils/PathUtils";
import { BrowserWindow, dialog } from "electron";
import BeanFactory from "../core/BeanFactory";
import Logger from "../core/Logger";

class SystemController {
  private readonly _systemService: SystemService;

  constructor(systemService: SystemService) {
    this._systemService = systemService;
  }

  openUrl(req: ControllerParam) {
    this._systemService
      .openUrl(req.args.url)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("SystemController.openUrl", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }

  relaunchApp(req: ControllerParam) {
    this._systemService
      .relaunch()
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("SystemController.relaunchApp", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }

  openAppData(req: ControllerParam) {
    this._systemService
      .openLocalPath(PathUtils.getAppData())
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("SystemController.openAppData", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }

  selectLocalFile(req: ControllerParam) {
    const { name, extensions } = req.args;
    if (!extensions || extensions.length === 0) {
      req.event.reply(req.channel, ResponseUtils.fail("可选择扩展名不能为空"));
    }
    const win: BrowserWindow = BeanFactory.getBean("win");
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: name, extensions: extensions }]
      })
      .then(result => {
        if (result.canceled) {
          // todo canceled
          ResponseUtils.success({
            canceled: true,
            path: ""
          });
        } else {
          ResponseUtils.success({
            canceled: true,
            path: result.filePaths[0]
          });
        }
      })
      .catch((err: Error) => {
        Logger.error("SystemController.selectLocalFile", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }
}

export default SystemController;
