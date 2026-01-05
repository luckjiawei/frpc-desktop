import "reflect-metadata";

import SystemService from "../service/SystemService";
import ResponseUtils from "../utils/ResponseUtils";
import PathUtils from "../utils/PathUtils";
import { BrowserWindow, dialog } from "electron";
import GitHubService from "../service/GitHubService";
import log from "electron-log/main";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";
@injectable()
export default class SystemController {
  private readonly _systemService: SystemService;
  private readonly _gitHubService: GitHubService;
  private readonly _container: Container;

  constructor(
    @inject(TYPES.SystemService) systemService: SystemService,
    @inject(TYPES.GitHubService) gitHubService: GitHubService,
    @inject(TYPES.Container) container: Container
  ) {
    this._systemService = systemService;
    this._gitHubService = gitHubService;
    this._container = container;
  }

  @IpcRoute(IPCChannels.SYSTEM_OPEN_URL)
  openUrl() {
    this._systemService
      .openUrl(req.args.url)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("SystemController.openUrl", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.SYSTEM_RELAUNCH_APP)
  async relaunchApp(event: any, args: any) {
    return await this._systemService.relaunch();
  }

  @IpcRoute(IPCChannels.SYSTEM_OPEN_APP_DATA)
  openAppData() {
    this._systemService
      .openLocalPath(PathUtils.getAppData())
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("SystemController.openAppData", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.SYSTEM_SELECT_LOCAL_FILE)
  selectLocalFile() {
    const { name, extensions } = req.args;
    if (!extensions || extensions.length === 0) {
      return;
      // req.event.reply(req.channel, ResponseUtils.fail("可选择扩展名不能为空"));
    }
    const win: BrowserWindow = this._container.get("win");
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: name, extensions: extensions }]
      })
      .then(result => {
        if (result.canceled) {
          // todo canceled
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
              path: result.filePaths[0]
            })
          );
        }
      })
      .catch((err: Error) => {
        log.error("SystemController.selectLocalFile", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.SYSTEM_GET_FRPC_DESKTOP_GITHUB_LAST_RELEASE)
  getFrpcDesktopGithubLastRelease() {
    this._gitHubService
      .getGithubLastRelease("luckjiawei/frpc-desktop")
      .then((data: any) => {
        req.event.reply(
          req.channel,
          ResponseUtils.success({
            manual: req.args.manual,
            version: data
          })
        );
      })
      .catch((err: Error) => {
        log.error("SystemController.getFrpcDesktopGithubLastRelease", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}
