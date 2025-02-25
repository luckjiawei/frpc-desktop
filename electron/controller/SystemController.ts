import SystemService from "../service/SystemService";
import ResponseUtils from "../utils/ResponseUtils";
import PathUtils from "../utils/PathUtils";

class SystemController {
  private readonly _systemService: SystemService;

  constructor(systemService: SystemService) {
    this._systemService = systemService;
  }

  openUrl(req: ControllerParam) {
    this._systemService
      .openUrl(req.args.url)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch(err => {
        req.event.reply(req.channel, ResponseUtils.fail());
      });
  }

  relaunchApp(req: ControllerParam) {
    this._systemService.relaunch().then(() => {
      req.event.reply(req.channel, ResponseUtils.success());
    });
  }

  openAppData(req: ControllerParam) {
    this._systemService.openLocalPath(PathUtils.getAppData()).then(() => {
      req.event.reply(req.channel, ResponseUtils.success());
    });
  }
}

export default SystemController;
