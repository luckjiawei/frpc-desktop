import { BrowserWindow, dialog } from "electron";
import fs from "fs";
import moment from "moment";
import BeanFactory from "../core/BeanFactory";
import Logger from "../core/Logger";
import FrpcProcessService from "../service/FrpcProcessService";
import ServerService from "../service/ServerService";
import SystemService from "../service/SystemService";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "./BaseController";

class ConfigController extends BaseController {
  private readonly _serverService: ServerService;
  private readonly _systemService: SystemService;
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(
    serverService: ServerService,
    systemService: SystemService,
    frpcProcessService: FrpcProcessService
  ) {
    super();
    this._serverService = serverService;
    this._systemService = systemService;
    this._frpcProcessService = frpcProcessService;
  }

  saveConfig(req: ControllerParam) {
    this._serverService
      .saveServerConfig(req.args)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("ConfigController.saveConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getServerConfig(req: ControllerParam) {
    this._serverService
      .getServerConfig()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ConfigController.getServerConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  openAppData(req: ControllerParam) {
    this._systemService
      .openLocalPath(PathUtils.getAppData())
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ConfigController.openAppData", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  resetAllConfig(req: ControllerParam) {
    // await this._serverDao.truncate();
    // await this._proxyDao.truncate();
    // await this._versionDao.truncate();
    this._frpcProcessService
      .stopFrpcProcess()
      .then(() => {
        fs.rmSync(PathUtils.getDataBaseStoragePath(), {
          recursive: true,
          force: true
        });

        fs.rmSync(PathUtils.getDownloadStoragePath(), {
          recursive: true,
          force: true
        });

        fs.rmSync(PathUtils.getVersionStoragePath(), {
          recursive: true,
          force: true
        });

        fs.rmSync(PathUtils.getFrpcLogStoragePath(), {
          recursive: true,
          force: true
        });
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("ConfigController.resetAllConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  exportConfig(req: ControllerParam) {
    dialog
      .showOpenDialog({
        properties: ["openDirectory"]
      })
      .then(result => {
        if (result.canceled) {
          req.event.reply(
            req.channel,
            ResponseUtils.success({
              canceled: true,
              path: ""
            })
          );
        } else {
          const path = `${result.filePaths[0]}/frpc-${moment(new Date()).format(
            "YYYYMMDDhhmmss"
          )}.toml`;
          this._serverService.genTomlConfig(path).then(() => {
            req.event.reply(
              req.channel,
              ResponseUtils.success({
                canceled: false,
                path: path
              })
            );
          });
        }
      })
      .catch((err: Error) => {
        Logger.error("ConfigController.exportConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  importTomlConfig(req: ControllerParam) {
    const win: BrowserWindow = BeanFactory.getBean("win");
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: "Frpc Toml ConfigFile", extensions: ["toml"] }]
      })
      .then(result => {
        if (result.canceled) {
          req.event.reply(
            req.channel,
            ResponseUtils.success({
              canceled: true,
              path: ""
            })
          );
        } else {
          req.event.reply(
            req.channel,
            ResponseUtils.success({
              canceled: false,
              path: ""
            })
          );
        }
      });
    // if (result.canceled) {
    // } else {
    // }
    // this._serverService
    //   .importTomlConfig()
    //   .then(() => {
    //     req.event.reply(req.channel, ResponseUtils.success());
    //   })
    //   .catch((err: Error) => {
    //     Logger.error("ConfigController.importTomlConfig", err);
    //     req.event.reply(req.channel, ResponseUtils.fail(err));
    //   });
  }

  getLanguage(req: ControllerParam) {
    this._serverService.getLanguage().then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }
}

export default ConfigController;
