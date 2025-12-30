import FrpcProcessService from "../service/FrpcProcessService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/BaseController";
import BeanFactory from "../core/BeanFactory";
import log from "electron-log/main";

export default class LaunchController extends BaseController {
  private readonly _frpcProcessService: FrpcProcessService;

  constructor() {
    super();
    this._frpcProcessService =
      BeanFactory.getBean<FrpcProcessService>("frpcProcessService");
  }

  launch(req: ControllerParam) {
    this._frpcProcessService
      .startFrpcProcess()
      .then(r => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("LaunchController.launch", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  terminate(req: ControllerParam) {
    this._frpcProcessService
      .stopFrpcProcess()
      .then(r => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch(err => {
        log.error("LaunchController.terminate", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getStatus(req: ControllerParam) {
    const running = this._frpcProcessService.isRunning();
    req.event.reply(
      req.channel,
      ResponseUtils.success({
        running: running,
        lastStartTime: this._frpcProcessService.frpcLastStartTime
      })
    );
  }
}
