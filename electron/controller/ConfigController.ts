import BaseController from "./BaseController";
import ServerService from "../service/ServerService";
import { success } from "../utils/response";
import PathUtils from "../utils/PathUtils";
import fs from "fs";
import FrpcProcessService from "../service/FrpcProcessService";
import SystemService from "../service/SystemService";

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
      req.event.reply(req.channel, success());
    });
  }

  getServerConfig(req: ControllerParam) {
    this._serverService.getServerConfig().then(data => {
      req.event.reply(req.channel, success(data));
    });
  }

  openAppData(req: ControllerParam) {
    this._systemService.openLocalPath(PathUtils.getAppData()).then(data => {
      req.event.reply(req.channel, success(data));
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

    req.event.reply(req.channel, success());
  }

  exportConfig(req: ControllerParam) {
    this._systemService.openDirectory().then(folder => {
      this._serverService.genTomlConfig(folder.filePaths[0]).then(() => {
        req.event.reply(req.channel, success());
      });
    });
  }
}

export default ConfigController;
