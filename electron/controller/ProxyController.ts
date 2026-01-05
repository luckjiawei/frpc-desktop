import "reflect-metadata";

import BaseController from "../core/controller";
import ProxyService from "../service/ProxyService";
import ResponseUtils from "../utils/ResponseUtils";
import ProxyRepository from "../repository/ProxyRepository";
import log from "electron-log/main";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";

@injectable()
export default class ProxyController extends BaseController {
  private readonly _proxyService: ProxyService;
  private readonly _proxyDao: ProxyRepository;

  constructor(
    @inject(TYPES.ProxyService) proxyService: ProxyService,
    @inject(TYPES.ProxyRepository) proxyRepository: ProxyRepository
  ) {
    super();
    this._proxyService = proxyService;
    this._proxyDao = proxyRepository;
  }

  @IpcRoute(IPCChannels.PROXY_CREATE_PROXY, 'on')
  createProxy() {
    this._proxyService
      .insertProxy(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("ProxyController.createProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.PROXY_MODIFY_PROXY)
  modifyProxy() {
    this._proxyService
      .updateProxy(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("ProxyController.modifyProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.PROXY_GET_ALL_PROXIES)
  getAllProxies() {
    this._proxyDao
      .selectAll()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("ProxyController.getAllProxies", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.PROXY_DELETE_PROXY)
  deleteProxy() {
    this._proxyService
      .deleteProxy(req.args)
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("ProxyController.deleteProxy", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.PROXY_MODIFY_PROXY_STATUS)
  modifyProxyStatus() {
    this._proxyDao
      .updateProxyStatus(req.args.id, req.args.status)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("ProxyController.modifyProxyStatus", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  @IpcRoute(IPCChannels.PROXY_GET_LOCAL_PORTS)
  getLocalPorts() {
    this._proxyService
      .getLocalPorts()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("ProxyController.getLocalPorts", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }
}
