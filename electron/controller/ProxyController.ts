import BaseController from "./BaseController";
import ProxyService from "../service/ProxyService";
import ResponseUtils from "../utils/ResponseUtils";
import ProxyRepository from "../repository/ProxyRepository";

class ProxyController extends BaseController {
  private readonly _proxyService: ProxyService;
  private readonly _proxyDao: ProxyRepository;

  constructor(proxyService: ProxyService, proxyDao: ProxyRepository) {
    super();
    this._proxyService = proxyService;
    this._proxyDao = proxyDao;
  }

  createProxy(req: ControllerParam) {
    this._proxyService.insertProxy(req.args).then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  modifyProxy(req: ControllerParam) {
    this._proxyService.updateProxy(req.args).then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  getAllProxies(req: ControllerParam) {
    this._proxyDao.findAll().then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  deleteProxy(req: ControllerParam) {
    this._proxyService.deleteProxy(req.args).then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  modifyProxyStatus(req: ControllerParam) {
    this._proxyDao.updateProxyStatus(req.args.id, req.args.status).then(() => {
      req.event.reply(req.channel, ResponseUtils.success());
    });
  }

  getLocalPorts(req: ControllerParam) {
    this._proxyService.getLocalPorts().then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }
}

export default ProxyController;
