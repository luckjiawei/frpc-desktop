import BaseController from "./BaseController";
import LogService from "../service/LogService";
import ResponseUtils from "../utils/ResponseUtils";
import Logger from "../core/Logger";

class LogController extends BaseController {
  private readonly _logService: LogService;

  constructor(logService: LogService) {
    super();
    this._logService = logService;
  }

  getFrpLogContent(req: ControllerParam) {
    this._logService
      .getFrpLogContent()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("LogController.getFrpLogContent", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  // watchFrpcLogContent(req: ControllerRequest) {
  //   this._logService.watchFrpcLog().then(data => {
  //     req.event.reply(req.reply, this.ResponseUtils.success(data));
  //   });
  // }

  openFrpcLogFile(req: ControllerParam) {
    this._logService
      .openFrpcLogFile()
      .then(data => {
        if (data) {
          ResponseUtils.success();
        } else {
          // ResponseUtils.fail();
        }
      })
      .catch((err: Error) => {
        Logger.error("LogController.openFrpcLogFile", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}

export default LogController;
