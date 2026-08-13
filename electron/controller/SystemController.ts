import SystemService from "../service/SystemService";
import ResponseUtils from "../utils/ResponseUtils";
import PathUtils from "../utils/PathUtils";
import { BrowserWindow, dialog } from "electron";
import BeanFactory from "../core/BeanFactory";
import Logger from "../core/Logger";
import GitHubService from "../service/GitHubService";
import AppConfigRepository from "../repository/AppConfigRepository";

class SystemController {
  private readonly _systemService: SystemService;
  private readonly _gitHubService: GitHubService;
  private readonly _appConfigRepository: AppConfigRepository;

  constructor(
    systemService: SystemService,
    gitHubService: GitHubService,
    appConfigRepository: AppConfigRepository
  ) {
    this._systemService = systemService;
    this._gitHubService = gitHubService;
    this._appConfigRepository = appConfigRepository;
  }

  openUrl(req: ControllerParam) {
    this._systemService
      .openUrl(req.args.url)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("SystemController.openUrl", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  relaunchApp(req: ControllerParam) {
    this._systemService
      .relaunch()
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("SystemController.relaunchApp", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  openAppData(req: ControllerParam) {
    this._systemService
      .openLocalPath(PathUtils.getAppData())
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("SystemController.openAppData", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  selectLocalFile(req: ControllerParam) {
    const { name, extensions } = req.args;
    if (!extensions || extensions.length === 0) {
      return;
      // req.event.reply(req.channel, ResponseUtils.fail("可选择扩展名不能为空"));
    }
    const win: BrowserWindow = BeanFactory.getBean("win");
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
        Logger.error("SystemController.selectLocalFile", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getFrpcDesktopGithubLastRelease(req: ControllerParam) {
    const manual = req.args.manual === true;
    if (!manual && !this._appConfigRepository.getSystemConfig().notifyUpdates) {
      req.event.reply(
        req.channel,
        ResponseUtils.success({
          manual,
          version: null,
          skipped: true
        })
      );
      return;
    }

    this._gitHubService
      .getGithubLastRelease("luckjiawei/frpc-desktop")
      .then((data: any) => {
        req.event.reply(
          req.channel,
          ResponseUtils.success({
            manual,
            version: data
          })
        );
      })
      .catch((err: Error) => {
        Logger.error("SystemController.getFrpcDesktopGithubLastRelease", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}

export default SystemController;
