import BaseService from "./BaseService";
import ServerDao from "../dao/ServerDao";
import TOML from "smol-toml";
import fs from "fs";
import PathUtils from "../utils/PathUtils";
import ProxyDao from "../dao/ProxyDao";

class ServerService extends BaseService<FrpcDesktopServer> {
  private readonly _serverDao: ServerDao;
  private readonly _proxyDao: ProxyDao;
  private readonly _serverId: string = "1";

  constructor(serverDao: ServerDao, proxyDao: ProxyDao) {
    super();
    this._serverDao = serverDao;
    this._proxyDao = proxyDao;
  }

  async saveServerConfig(
    frpcServer: FrpcDesktopServer
  ): Promise<FrpcDesktopServer> {
    frpcServer._id = this._serverId;
    return await this._serverDao.updateById(this._serverId, frpcServer);
  }

  async getServerConfig(): Promise<FrpcDesktopServer> {
    return await this._serverDao.findById(this._serverId);
  }

  hasServerConfig(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._serverDao
        .exists(this._serverId)
        .then(r => {
          resolve(r);
        })
        .catch(err => reject(err));
    });
  }

  async genTomlConfig() {
    const server = await this.getServerConfig();
    const proxies = await this._proxyDao.findAll();
    const enabledProxies = proxies
      .filter(f => f.status === 1)
      .map(proxy => {
        const { _id, status, ...frpProxyConfig } = proxy;
        return frpProxyConfig
      });
    const { frpcVersion, _id, system, ...commonConfig } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePath();
    const toml = TOML.stringify({ ...frpcConfig, enabledProxies });
    fs.writeFile(
      PathUtils.getTomlConfigFilePath(), // 配置文件目录
      toml, // 配置文件内容
      { flag: "w" },
      err => {
        if (err) {
        } else {
          // callback(filename);
        }
      }
    );
  }
}

export default ServerService;
