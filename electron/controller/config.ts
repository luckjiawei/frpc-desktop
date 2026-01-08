import "reflect-metadata";

import { BrowserWindow, dialog } from "electron";
import fs from "fs";
import moment from "moment";
import FrpcProcessService from "../service/frpc-process";
import OpenSourceFrpcDesktopConfigService from "../service/config";
import SystemService from "../service/system";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/controller";
import log from "electron-log/main";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";
import FileUtils from "../utils/file";

@injectable()
export default class ConfigController extends BaseController {
  @inject(TYPES.OpenSourceFrpcDesktopConfigService)
  private readonly _serverService: OpenSourceFrpcDesktopConfigService;
  @inject(TYPES.SystemService)
  private readonly _systemService: SystemService;
  @inject(TYPES.FrpcProcessService)
  private readonly _frpcProcessService: FrpcProcessService;
  @inject(TYPES.Container)
  private readonly _container: Container;

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

  /**
   * 
   * @param event 
   */
  @IpcRoute(IPCChannels.CONFIG_RESET_ALL_CONFIG, "on", { manualReply: true })
  public async resetAllConfig(event: any) {
    this._frpcProcessService
      .stopFrpcProcess()
      .then(() => {
        FileUtils.remove(PathUtils.getDatabaseFilename());
        FileUtils.remove(PathUtils.getDownloadStoragePath());
        FileUtils.remove(PathUtils.getVersionStoragePath());
        FileUtils.remove(PathUtils.getFrpcLogStoragePath());

        event.reply(IPCChannels.CONFIG_RESET_ALL_CONFIG, ResponseUtils.success());
      })
      .catch((err: Error) => {
        event.reply(IPCChannels.CONFIG_RESET_ALL_CONFIG, ResponseUtils.fail(err));
      });
  }

  /**
   * 
   * @param event 
   */
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

  /**
   * 
   * @param event 
   */
  @IpcRoute(IPCChannels.CONFIG_IMPORT_TOML_CONFIG, "on", { manualReply: true })
  async importTomlConfig(event: any) {
    const win = this._container.get<BrowserWindow>(TYPES.BrowserWindow);
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Frpc Toml ConfigFile", extensions: ["toml"] }]
    });
    if (result.canceled) {
      event.reply(IPCChannels.CONFIG_IMPORT_TOML_CONFIG, ResponseUtils.success({
        canceled: true,
        path: ""
      }));
    } else {
      const resp = await this._serverService.importTomlConfig(result.filePaths[0]);
      event.reply(IPCChannels.CONFIG_IMPORT_TOML_CONFIG, ResponseUtils.success(resp));
    }
  }

  /**
   * 
   * @param event 
   * @returns 
   */
  @IpcRoute(IPCChannels.CONFIG_GET_LANGUAGE)
  async getLanguage(event: any) {
    return await this._serverService.getLanguage();
  }

  /**
   * 
   * @param event 
   * @param args 
   */
  @IpcRoute(IPCChannels.CONFIG_SAVE_LANGUAGE)
  public async saveLanguage(event: any, args: { language: string }) {
    await this._serverService.saveLanguage(args.language);
  }
}
