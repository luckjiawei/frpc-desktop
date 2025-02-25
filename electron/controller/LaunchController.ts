import BaseController from "./BaseController";
import FrpcProcessService from "../service/FrpcProcessService";
import ResponseUtils from "../utils/ResponseUtils";

class LaunchController extends BaseController {
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(frpcProcessService: FrpcProcessService) {
    super();
    this._frpcProcessService = frpcProcessService;
  }

  launch(req: ControllerParam) {
    this._frpcProcessService
      .startFrpcProcess()
      .then(r => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch(err => {
        console.log(err, "1");
      });
  }

  terminate(req: ControllerParam) {
    this._frpcProcessService.stopFrpcProcess().then(r => {
      req.event.reply(req.channel, ResponseUtils.success());
    });
  }

  getStatus(req: ControllerParam) {
    const running = this._frpcProcessService.isRunning();
    req.event.reply(req.channel, ResponseUtils.success(running));
  }
}

export default LaunchController;