import FrpcProcessService from "../service/FrpcProcessService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/controller";

import log from "electron-log/main";
import "reflect-metadata";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";

/**
 * launch controller
 */
@injectable()
export default class LaunchController extends BaseController {
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(
    @inject(TYPES.FrpcProcessService) frpcProcessService: FrpcProcessService
  ) {
    super();
    this._frpcProcessService = frpcProcessService;
  }

  /**
   * launch frpc process
   */
  @IpcRoute(IPCChannels.LAUNCH)
  launch() {
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

  /**
   * terminate frpc process
   */
  @IpcRoute(IPCChannels.TERMINATE)
  terminate() {
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

  // /**
  //  * get frpc process status
  //  */
  // @IpcRoute(IPCChannels.GET_STATUS)
  // getStatus() {
  //   const running = this._frpcProcessService.isRunning();
  //   req.event.reply(
  //     req.channel,
  //     ResponseUtils.success({
  //       running: running,
  //       lastStartTime: this._frpcProcessService.frpcLastStartTime
  //     })
  //   );
  // }
}
