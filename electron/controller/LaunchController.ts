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
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("LaunchController.launch", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  terminate(req: ControllerParam) {
    this._frpcProcessService
      .stopConnection()
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch(err => {
        Logger.error("LaunchController.terminate", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  async getStatus(req: ControllerParam) {
    try {
      await this._frpcProcessService.restoreExistingProcess();
      const running = this._frpcProcessService.isRunning();
      const connectionError = running
        ? this._frpcProcessService.frpcConnectionError
        : null;
      req.event.reply(
        req.channel,
        ResponseUtils.success({
          running,
          lastStartTime: this._frpcProcessService.frpcLastStartTime,
          connectionError
        })
      );
    } catch {
      Logger.warn("LaunchController.getStatus", "Service query failed");
      req.event.reply(req.channel, {
        bizCode: "B1100",
        data: null,
        message: "SERVICE_STATUS_FAILED"
      });
    }
  }
}

export default LaunchController;
