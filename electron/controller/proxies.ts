import "reflect-metadata";

import BaseController from "../core/controller";
import ProxiesService from "../service/ProxyService";
import ProxiesRepository from "../repository/ProxyRepository";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";
import { IpcRoute } from "../core/decorators";
import { IPCChannels } from "../core/constant";

@injectable()
export default class ProxiesController extends BaseController {
  @inject(TYPES.ProxiesService)
  private readonly _proxiesService: ProxiesService;
  @inject(TYPES.ProxiesRepository)
  private readonly _proxiesRepository: ProxiesRepository;


  @IpcRoute(IPCChannels.PROXY_CREATE_PROXY)
  public async createProxy(event: any, args: any) {
    return await this._proxiesService
      .insertProxy(args)
  }

  @IpcRoute(IPCChannels.PROXY_MODIFY_PROXY)
  public async modifyProxy(event: any, args: any) {
    return await this._proxiesService
      .updateProxy(args)
  }

  @IpcRoute(IPCChannels.PROXY_GET_ALL_PROXIES)
  public async getAllProxies(event: any, args: any) {
    return await this._proxiesService
      .getAllProxies()
  }

  @IpcRoute(IPCChannels.PROXY_DELETE_PROXY)
  public async deleteProxy(event: any, args: any) {
    return await this._proxiesService
      .deleteProxy(args)
  }

  @IpcRoute(IPCChannels.PROXY_MODIFY_PROXY_STATUS)
  public async modifyProxyStatus(event: any, args: any) {
    return await this._proxiesRepository
      .updateProxyStatus(args.id, args.status)
  }

  @IpcRoute(IPCChannels.PROXY_GET_LOCAL_PORTS)
  public async getLocalPorts(event: any, args: any) {
    return await this._proxiesService
      .getLocalPorts()
  }
}
