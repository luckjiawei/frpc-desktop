import "reflect-metadata";

import SystemService from "../service/SystemService";
import ResponseUtils from "../utils/ResponseUtils";
import PathUtils from "../utils/PathUtils";
import { BrowserWindow, dialog } from "electron";
import GitHubService from "../service/GitHubService";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";
import BaseController from "../core/controller";

@injectable()
export default class SystemController extends BaseController {
  @inject(TYPES.SystemService)
  private readonly _systemService: SystemService;
  @inject(TYPES.GitHubService)
  private readonly _gitHubService: GitHubService;
  @inject(TYPES.Container)
  private readonly _container: Container;


  @IpcRoute(IPCChannels.SYSTEM_OPEN_URL)
  public async openUrl(event: any, args: { url: string }) {
    return await this._systemService.openUrl(args.url);
  }

  @IpcRoute(IPCChannels.SYSTEM_RELAUNCH_APP)
  public async relaunchApp(event: any) {
    return await this._systemService.relaunch();
  }

  @IpcRoute(IPCChannels.SYSTEM_OPEN_APP_DATA)
  public async openAppData(event: any) {
    return await this._systemService.openLocalPath(PathUtils.getAppData());
  }

  @IpcRoute(IPCChannels.SYSTEM_SELECT_LOCAL_FILE, "on", { manualReply: true })
  public async selectLocalFile(
    event: any, args: { name: string; extensions: string[] }) {
    const { name, extensions } = args;
    if (!extensions || extensions.length === 0) {
      return;
    }
    const win: BrowserWindow = this._container.get("win");
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: name, extensions: extensions }]
      })
      .then(result => {
        if (result.canceled) {
          event.reply(
            IPCChannels.SYSTEM_SELECT_LOCAL_FILE,
            ResponseUtils.success({
              canceled: true,
              path: ""
            })
          );
        } else {
          event.reply(
            IPCChannels.SYSTEM_SELECT_LOCAL_FILE,
            ResponseUtils.success({
              canceled: false,
              path: result.filePaths[0]
            })
          );
        }
      })
      .catch((err: Error) => {
        event.reply(
          IPCChannels.SYSTEM_SELECT_LOCAL_FILE,
          ResponseUtils.fail(err)
        );
      });
  }

  @IpcRoute(IPCChannels.SYSTEM_GET_FRPC_DESKTOP_GITHUB_LAST_RELEASE)
  public async getFrpcDesktopGithubLastRelease(event: any) {
    return await this._gitHubService.getGithubLastRelease("luckjiawei/frpc-desktop");
  }
}
