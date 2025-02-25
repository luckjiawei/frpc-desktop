import BaseController from "./BaseController";
import LogService from "../service/LogService";
import ResponseUtils from "../utils/ResponseUtils";

class LogController extends BaseController {
  private readonly _logService: LogService;

  constructor(logService: LogService) {
    super();
    this._logService = logService;
  }

  getFrpLogContent(req: ControllerParam) {
    this._logService.getFrpLogContent().then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  // watchFrpcLogContent(req: ControllerRequest) {
  //   this._logService.watchFrpcLog().then(data => {
  //     console.log('reply watch', data);
  //     req.event.reply(req.reply, this.ResponseUtils.success(data));
  //   });
  // }

  openFrpcLogFile(req: ControllerParam) {
    this._logService.openFrpcLogFile().then(data => {
      if (data) {
        ResponseUtils.success(null);
      } else {
        ResponseUtils.fail();
      }
    });
  }
}

export default LogController;
