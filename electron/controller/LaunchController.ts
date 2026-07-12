import Logger from "../core/Logger";
import FrpcProcessService from "../service/FrpcProcessService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "./BaseController";

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
      .catch((err: Error) => {
        Logger.error("LaunchController.launch", err);
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
        Logger.error("LaunchController.terminate", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getStatus(req: ControllerParam) {
    const running = this._frpcProcessService.isRunning();
    const connectionError = running
      ? this._frpcProcessService.readFrpcConnectionError()
      : null;
    req.event.reply(
      req.channel,
      ResponseUtils.success({
        running,
        lastStartTime: this._frpcProcessService.frpcLastStartTime,
        connectionError,
        externalFrpc: this._frpcProcessService.getExternalFrpcStatus()
      })
    );
  }

  getExternalStatus(req: ControllerParam) {
    req.event.reply(
      req.channel,
      ResponseUtils.success(this._frpcProcessService.getExternalFrpcStatus(true))
    );
  }

  stopExternal(req: ControllerParam) {
    this._frpcProcessService
      .stopExternalFrpcProcess()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch(err => {
        Logger.error("LaunchController.stopExternal", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  importExternalConfig(req: ControllerParam) {
    this._frpcProcessService
      .importExternalFrpcConfig()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch(err => {
        Logger.error("LaunchController.importExternalConfig", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}

export default LaunchController;
