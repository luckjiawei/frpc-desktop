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
  @inject(TYPES.ProxyService)
  private readonly _proxyService: ProxyService;
  @inject(TYPES.ProxyRepository)
  private readonly _proxyDao: ProxyRepository;


  @IpcRoute(IPCChannels.PROXY_CREATE_PROXY)
  public async createProxy(event: any, args: any) {
    return await this._proxyService
      .insertProxy(args)
  }

  @IpcRoute(IPCChannels.PROXY_MODIFY_PROXY)
  public async modifyProxy(event: any, args: any) {
    return await this._proxyService
      .updateProxy(args)
  }

  @IpcRoute(IPCChannels.PROXY_GET_ALL_PROXIES)
  public async getAllProxies(event: any, args: any) {
    return await this._proxyDao
      .selectAll()
  }

  @IpcRoute(IPCChannels.PROXY_DELETE_PROXY)
  public async deleteProxy(event: any, args: any) {
    return await this._proxyService
      .deleteProxy(args)
  }

  @IpcRoute(IPCChannels.PROXY_MODIFY_PROXY_STATUS)
  public async modifyProxyStatus(event: any, args: any) {
    return await this._proxyDao
      .updateProxyStatus(args.id, args.status)
  }

  @IpcRoute(IPCChannels.PROXY_GET_LOCAL_PORTS)
  public async getLocalPorts(event: any, args: any) {
    return await this._proxyService
      .getLocalPorts()
  }
}
