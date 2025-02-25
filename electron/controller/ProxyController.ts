import BaseController from "./BaseController";
import ProxyService from "../service/ProxyService";
import ResponseUtils from "../utils/ResponseUtils";
import ProxyRepository from "../repository/ProxyRepository";
import Logger from "../core/Logger";

class ProxyController extends BaseController {
  private readonly _proxyService: ProxyService;
  private readonly _proxyDao: ProxyRepository;

  constructor(proxyService: ProxyService, proxyDao: ProxyRepository) {
    super();
    this._proxyService = proxyService;
    this._proxyDao = proxyDao;
  }

  createProxy(req: ControllerParam) {
    this._proxyService
      .insertProxy(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.createProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  modifyProxy(req: ControllerParam) {
    this._proxyService
      .updateProxy(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.modifyProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getAllProxies(req: ControllerParam) {
    this._proxyDao
      .findAll()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.getAllProxies", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  deleteProxy(req: ControllerParam) {
    this._proxyService
      .deleteProxy(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.deleteProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  modifyProxyStatus(req: ControllerParam) {
    this._proxyDao
      .updateProxyStatus(req.args.id, req.args.status)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.modifyProxyStatus", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  getLocalPorts(req: ControllerParam) {
    this._proxyService
      .getLocalPorts()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("ProxyController.getLocalPorts", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}

export default ProxyController;
