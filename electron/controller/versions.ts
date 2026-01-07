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
import { IPCChannels } from "../core/constant";

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
  async getVersions(event: any) {
    const result = await this._versionService.getFrpVersionsByGitHub();
    return result;
  }

  /**
   * get downloaded frp versions
   * @param event 
   * @returns 
   */
  @IpcRoute(IPCChannels.VERSION_GET_DOWNLOADED_VERSIONS)
  public async getDownloadedVersions(event: any) {
    return await this._versionService.getDownloadedVersions();
  }

  /**
   * download frp version from github
   * @param event 
   * @param args 
   */
  @IpcRoute(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, "on", { manualReply: true })
  downloadFrpVersion(event: any, args: any) {
    this._versionService
      .downloadFrpVersion(args.githubReleaseId, progress => {
        // send progress to renderer process
        event.reply(
          IPCChannels.VERSION_DOWNLOAD_FRP_VERSION,
          ResponseUtils.success({
            percent: progress.percent,
            githubReleaseId: args.githubReleaseId,
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

  /**
   * delete downloaded frp version
   * @param event 
   * @param args 
   * @returns 
   */
  @IpcRoute(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION)
  public async deleteDownloadedVersion(event: any, args: { githubReleaseId: number }) {
    return await this._versionService
      .deleteFrpVersion(args.githubReleaseId)

  }

  /**
   * import local frpc version
   * @param event 
   * @param args 
   */
  @IpcRoute(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION, "on", { manualReply: true })
  importLocalFrpcVersion(event: any, args: any) {
    const win: BrowserWindow = this._container.get(TYPES.BrowserWindow);
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [
          { name: "Frpc", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
        ]
      })
      .then(result => {
        if (result.canceled) {
          event.reply(
            IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION,
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
              event.reply(
                IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION,
                ResponseUtils.success({
                  canceled: false
                })
              );
            })
            .catch((err: Error) => {
              event.reply(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION, ResponseUtils.fail(err));
            });
        }
      })
      .catch(err => {
        event.reply(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION, ResponseUtils.fail(err));
      });
  }


}
