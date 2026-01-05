import "reflect-metadata";

import LogService from "../service/LogService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/controller";
import log from "electron-log/main";
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
  getFrpLogContent() {
    this._logService
      .getFrpLogContent()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("LogController.getFrpLogContent", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  /**
   * get app log content
   */
  @IpcRoute(IPCChannels.LOG_GET_APP_LOG_CONTENT)
  getAppLogContent() {
    this._logService
      .getAppLogContent()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("LogController.getAppLogContent", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  // watchFrpcLogContent(req: ControllerRequest) {
  //   this._logService.watchFrpcLog().then(data => {
  //     req.event.reply(req.reply, this.ResponseUtils.success(data));
  //   });
  // }

  /**
   * open frpc log file
   */
  @IpcRoute(IPCChannels.LOG_OPEN_FRPC_LOG_FILE)
  openFrpcLogFile() {
    this._logService
      .openFrpcLogFile()
      .then(data => {
        if (data) {
          ResponseUtils.success();
        } else {
          // ResponseUtils.fail();
        }
      })
      .catch((err: Error) => {
        log.error("LogController.openFrpcLogFile", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  /**
   * open app log file
   */
  @IpcRoute(IPCChannels.LOG_OPEN_APP_LOG_FILE)
  openAppLogFile() {
    this._logService
      .openAppLogFile()
      .then(data => {
        if (data) {
          ResponseUtils.success();
        } else {
          // ResponseUtils.fail();
        }
      })
      .catch((err: Error) => {
        log.error("LogController.openAppLogFile", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}
