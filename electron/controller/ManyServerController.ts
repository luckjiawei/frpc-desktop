import ManyServerRepository from "electron/repository/ManyServerRepository";
import Logger from "../core/Logger";
import ManyServerService from "../service/ManyServerService";
import ResponseUtils from "../utils/ResponseUtils";
import BaseController from "./BaseController";

class ManyServerController extends BaseController {
  private readonly _manyServerService: ManyServerService;
  private readonly _manyServerRepository: ManyServerRepository;

  constructor(
    manyServerService: ManyServerService,
    manyServerRepository: ManyServerRepository
  ) {
    super();
    this._manyServerService = manyServerService;
    this._manyServerRepository = manyServerRepository;
  }

  createServer(req: ControllerParam) {
    this._manyServerService
      .insertServer(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.createProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  modifyServer(req: ControllerParam) {
    this._manyServerService
      .updateServer(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.modifyProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getAllServer(req: ControllerParam) {
    this._manyServerService
      .getAllServer()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.getAllProxies", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  deleteServer(req: ControllerParam) {
    this._manyServerService
      .deleteServer(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.deleteProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}
export default ManyServerController;
