import BaseController from "./BaseController";
import ServerService from "../service/ServerService";
import PathUtils from "../utils/PathUtils";
import fs from "fs";
import FrpcProcessService from "../service/FrpcProcessService";
import SystemService from "../service/SystemService";
import moment from "moment";
import ResponseUtils from "../utils/ResponseUtils";
import { dialog } from "electron";

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
    this._serverService.saveServerConfig(req.args).then(() => {
      req.event.reply(req.channel, ResponseUtils.success());
    });
  }

  getServerConfig(req: ControllerParam) {
    this._serverService.getServerConfig().then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  openAppData(req: ControllerParam) {
    this._systemService.openLocalPath(PathUtils.getAppData()).then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  async resetAllConfig(req: ControllerParam) {
    // await this._serverDao.truncate();
    // await this._proxyDao.truncate();
    // await this._versionDao.truncate();
    await this._frpcProcessService.stopFrpcProcess();
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
      });
  }

  importTomlConfig(req: ControllerParam) {
    this._serverService.importTomlConfig().then(() => {
      req.event.reply(req.channel, ResponseUtils.success());
    });
  }
}

export default ConfigController;
