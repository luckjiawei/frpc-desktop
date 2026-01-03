import "reflect-metadata";

import LogService from "../service/LogService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "../core/BaseController";
import log from "electron-log/main";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";

@injectable()
export default class LogController extends BaseController {
  private readonly _logService: LogService;

  constructor(@inject(TYPES.LogService) logService: LogService) {
    super();
    this._logService = logService;
  }

  getFrpLogContent(req: ControllerParam) {
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

  getAppLogContent(req: ControllerParam) {
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

  openFrpcLogFile(req: ControllerParam) {
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

  openAppLogFile(req: ControllerParam) {
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
