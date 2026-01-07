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
  public async resetAllConfig(event: any) {
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
        event.reply(IPCChannels.CONFIG_RESET_ALL_CONFIG, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("ConfigController.resetAllConfig", err);
        event.reply(IPCChannels.CONFIG_RESET_ALL_CONFIG, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.CONFIG_EXPORT_CONFIG)
  exportConfig(event: any) {
    dialog
      .showOpenDialog({
        properties: ["openDirectory"]
      })
      .then(result => {
        if (result.canceled) {
          event.reply(
            IPCChannels.CONFIG_EXPORT_CONFIG,
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
            event.reply(
              IPCChannels.CONFIG_EXPORT_CONFIG,
              ResponseUtils.success({
                canceled: false,
                path: path
              })
            );
          });
        }
      })
      .catch((err: Error) => {
        event.reply(IPCChannels.CONFIG_EXPORT_CONFIG, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.CONFIG_IMPORT_TOML_CONFIG)
  importTomlConfig(event: any) {
    this._serverService
      .importTomlConfig()
      .then(data => {
        event.reply(IPCChannels.CONFIG_IMPORT_TOML_CONFIG, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        event.reply(IPCChannels.CONFIG_IMPORT_TOML_CONFIG, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.CONFIG_GET_LANGUAGE)
  async getLanguage(event: any) {
    return await this._serverService.getLanguage();
  }

  @IpcRoute(IPCChannels.CONFIG_SAVE_LANGUAGE)
  public async saveLanguage(event: any, args: { language: string }) {
    await this._serverService.saveLanguage(args.language);
  }
}
