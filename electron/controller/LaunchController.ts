import BaseController from "./BaseController";
import FrpcProcessService from "../service/FrpcProcessService";
import { success } from "../utils/response";

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
        req.event.reply(req.channel, success());
      })
      .catch(err => {
        console.log(err, "1");
      });
  }

  terminate(req: ControllerParam) {
    this._frpcProcessService.stopFrpcProcess().then(r => {
      req.event.reply(req.channel, success());
    });
  }

  getStatus(req: ControllerParam) {
    const running = this._frpcProcessService.isRunning();
    req.event.reply(req.channel, success(running));
  }
}

export default LaunchController;