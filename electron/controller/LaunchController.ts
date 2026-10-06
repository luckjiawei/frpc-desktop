import Logger from "../core/Logger";
import FrpcProcessService from "../service/FrpcProcessService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "./BaseController";
import BeanFactory from "../core/BeanFactory";
import WindowsServiceService from "../service/WindowsServiceService";

class LaunchController extends BaseController {
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(frpcProcessService: FrpcProcessService) {
    super();
    this._frpcProcessService = frpcProcessService;
  }

  launch(req: ControllerParam) {
    const service: WindowsServiceService = BeanFactory.getBean(
      "windowsServiceService"
    );
    const operation = service.installed
      ? service.manage("start")
      : this._frpcProcessService.startFrpcProcess();
    operation
      .then(r => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("LaunchController.launch", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  terminate(req: ControllerParam) {
    const service: WindowsServiceService = BeanFactory.getBean(
      "windowsServiceService"
    );
    const operation = service.installed
      ? service.manage("stop")
      : this._frpcProcessService.stopFrpcProcess();
    operation
      .then(r => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch(err => {
        Logger.error("LaunchController.terminate", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  async getStatus(req: ControllerParam) {
    const service: WindowsServiceService = BeanFactory.getBean(
      "windowsServiceService"
    );
    await service.getStatus();
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
  }
}

export default LaunchController;
