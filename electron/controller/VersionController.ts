import "reflect-metadata";

import BaseController from "../core/controller";
import VersionService from "../service/VersionService";
import ResponseUtils from "../utils/ResponseUtils";
import VersionRepository from "../repository/VersionRepository";
import { BrowserWindow, dialog } from "electron";
import log from "electron-log/main";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels, ResponseCode } from "../core/constant";
import BusinessError from "electron/core/error";

@injectable()
export default class VersionController extends BaseController {
  @inject(TYPES.VersionService)
  private readonly _versionService: VersionService;
  @inject(TYPES.VersionRepository)
  private readonly _versionDao: VersionRepository;
  @inject(TYPES.Container)
  private readonly _container: Container;

  /**
   * get frp versions from github
   * @param event 
   * @returns 
   */
  @IpcRoute(IPCChannels.VERSION_GET_VERSIONS)
  async getVersions() {
    const result = await this._versionService.getFrpVersionsByGitHub();
    return result;
  }

  @IpcRoute(IPCChannels.VERSION_GET_DOWNLOADED_VERSIONS)
  getDownloadedVersions(event: any) {
    this._versionDao
      .selectAll()
      .then(data => {
        event.reply(event.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("VersionController.getDownloadedVersions", err);
        event.reply(event.channel, ResponseUtils.fail(err));
      });
  }

  /**
   * download frp version from github
   * @param event 
   * @param args 
   */
  @IpcRoute(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, "on", { manualReply: true })
  downloadFrpVersion(event: any, args: any) {
    this._versionService
      .downloadFrpVersion(args.github_asset_id, progress => {
        // send progress to renderer process
        event.reply(
          IPCChannels.VERSION_DOWNLOAD_FRP_VERSION,
          ResponseUtils.success({
            percent: progress.percent,
            githubReleaseId: args.github_asset_id,
            completed: progress.percent >= 1
          })
        );
      })
      .then(r => {
        event.reply(
          IPCChannels.VERSION_DOWNLOAD_FRP_VERSION,
          ResponseUtils.success({
            percent: 1,
            githubReleaseId: args.github_asset_id,
            completed: true
          })
        );
      })
      .catch((err: Error) => {
        event.reply(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION)
  deleteDownloadedVersion(event: any, args: any) {
    this._versionService
      .deleteFrpVersion(args.githubReleaseId)
      .then(() => {
        event.reply(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("VersionController.deleteDownloadedVersion", err);
        event.reply(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION)
  importLocalFrpcVersion() {
    const win: BrowserWindow = this._container.get("win");
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [
          { name: "Frpc", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
        ]
      })
      .then(result => {
        if (result.canceled) {
          req.event.reply(
            req.channel,
            ResponseUtils.success({
              canceled: true
            })
          );
          return;
        } else {
          const filePath = result.filePaths[0];
          this._versionService
            .importLocalFrpcVersion(filePath)
            .then(data => {
              req.event.reply(
                req.channel,
                ResponseUtils.success({
                  canceled: false
                })
              );
            })
            .catch((err: Error) => {
              log.error("VersionController.importLocalFrpcVersion", err);
              req.event.reply(req.channel, ResponseUtils.fail(err));
            });
        }
      })
      .catch(err => {
        log.error("VersionController.importLocalFrpcVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });

    // const win: BrowserWindow = BeanFactory.getBean("win");
    // const result = await dialog.showOpenDialog(win, {
    //   properties: ["openFile"],
    //   filters: [
    //     { name: "Frpc", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
    //   ]
    // });
    // if (result.canceled) {
    //
    // }else {
    //
    // }
  }
}
