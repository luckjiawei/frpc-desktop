import "reflect-metadata";

import LogService from "../service/log";
import BaseController from "../core/controller";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";

/**
 * log controller
 */
@injectable()
export default class LogController extends BaseController {
  private readonly _logService: LogService;

  constructor(@inject(TYPES.LogService) logService: LogService) {
    super();
    this._logService = logService;
  }

  /**
   * get frpc log content
   */
  @IpcRoute(IPCChannels.LOG_GET_FRP_LOG_CONTENT)
  public async getFrpLogContent() {
    return await this._logService.getFrpLogContent();
  }

  /**
   * get app log content
   */
  @IpcRoute(IPCChannels.LOG_GET_APP_LOG_CONTENT)
  public async getAppLogContent() {
    return await this._logService.getAppLogContent();
  }

  /**
   * open frpc log file
   */
  @IpcRoute(IPCChannels.LOG_OPEN_FRPC_LOG_FILE)
  public async openFrpcLogFile() {
    return await this._logService.openFrpcLogFile();
  }

  /**
   * open app log file
   */
  @IpcRoute(IPCChannels.LOG_OPEN_APP_LOG_FILE)
  public async openAppLogFile() {
    return await this._logService.openAppLogFile();
  }
}
