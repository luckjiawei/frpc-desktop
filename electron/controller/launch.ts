import FrpcProcessService from "../service/FrpcProcessService";
import BaseController from "../core/controller";

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
  public async launch(event: any) {
    return await this._frpcProcessService.startFrpcProcess();
  }

  /**
   * terminate frpc process
   */
  @IpcRoute(IPCChannels.TERMINATE)
  public async terminate(event: any) {
    return await this._frpcProcessService.stopFrpcProcess();
  }
}
