import "reflect-metadata";

import { dialog } from "electron";
import fs from "fs";
import moment from "moment";
import FrpcProcessService from "../service/FrpcProcessService";
import OpenSourceFrpcDesktopConfigService from "../service/OpenSourceFrpcDesktopConfigService";
import SystemService from "../service/SystemService";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/controller";
import log from "electron-log/main";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";

@injectable()
export default class ConfigController extends BaseController {
  private readonly _serverService: OpenSourceFrpcDesktopConfigService;
  private readonly _systemService: SystemService;
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(
    @inject(TYPES.OpenSourceFrpcDesktopConfigService)
    serverService: OpenSourceFrpcDesktopConfigService,
    @inject(TYPES.SystemService) systemService: SystemService,
    @inject(TYPES.FrpcProcessService) frpcProcessService: FrpcProcessService
  ) {
    super();
    this._serverService = serverService;
    this._systemService = systemService;
    this._frpcProcessService = frpcProcessService;
  }

  @IpcRoute(IPCChannels.CONFIG_SAVE_CONFIG)
  public async saveConfig(event: any, args: any) {
    return await this._serverService
      .saveServerConfig(args);
  }

  @IpcRoute(IPCChannels.CONFIG_GET_SERVER_CONFIG)
  public async getServerConfig(event: any, args: any) {
    return await this._serverService
      .getServerConfig();
  }

  @IpcRoute(IPCChannels.CONFIG_OPEN_APP_DATA)
  public openAppData(event: any, args: any) {
    this._systemService
      .openLocalPath(PathUtils.getAppData());
  }

  @IpcRoute(IPCChannels.CONFIG_RESET_ALL_CONFIG)
  resetAllConfig() {
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
        log.error("ConfigController.resetAllConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.CONFIG_EXPORT_CONFIG)
  exportConfig() {
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
        log.error("ConfigController.exportConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.CONFIG_IMPORT_TOML_CONFIG)
  importTomlConfig() {
    // const win: BrowserWindow = BeanFactory.getBean("win");
    // dialog
    //   .showOpenDialog(win, {
    //     properties: ["openFile"],
    //     filters: [{ name: "Frpc Toml ConfigFile", extensions: ["toml"] }]
    //   })
    //   .then(result => {
    //     if (result.canceled) {
    //       req.event.reply(
    //         req.channel,
    //         ResponseUtils.success({
    //           canceled: true,
    //           path: ""
    //         })
    //       );
    //     } else {
    //       req.event.reply(
    //         req.channel,
    //         ResponseUtils.success({
    //           canceled: false,
    //           path: ""
    //         })
    //       );
    //     }
    //   });
    // if (result.canceled) {
    // } else {
    // }
    this._serverService
      .importTomlConfig()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("ConfigController.importTomlConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.CONFIG_GET_LANGUAGE)
  async getLanguage(event: any) {
    return await this._serverService.getLanguage();
  }

  @IpcRoute(IPCChannels.CONFIG_SAVE_LANGUAGE)
  saveLanguage() {
    this._serverService
      .saveLanguage(req.args)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("ConfigController.saveLanguage", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}
