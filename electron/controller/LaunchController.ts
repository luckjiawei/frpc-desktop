import FrpcProcessService from "../service/FrpcProcessService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/BaseController";
import BeanFactory from "../core/BeanFactory";
import log from "electron-log/main";
import "reflect-metadata";
import { injectable, inject } from "inversify";
import { TYPES } from "../main";

@injectable()
export default class LaunchController extends BaseController {
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(
    @inject(TYPES.FrpcProcessService) frpcProcessService: FrpcProcessService
  ) {
    super();
    this._frpcProcessService = frpcProcessService;
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
