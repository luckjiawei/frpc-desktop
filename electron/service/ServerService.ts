import BaseService from "./BaseService";
import ServerRepository from "../repository/ServerRepository";
import TOML from "smol-toml";
import fs from "fs";
import PathUtils from "../utils/PathUtils";
import ProxyRepository from "../repository/ProxyRepository";

class ServerService extends BaseService<OpenSourceFrpcDesktopServer> {
  private readonly _serverDao: ServerRepository;
  private readonly _proxyDao: ProxyRepository;
  private readonly _serverId: string = "1";

  constructor(serverDao: ServerRepository, proxyDao: ProxyRepository) {
    super();
    this._serverDao = serverDao;
    this._proxyDao = proxyDao;
  }

  async saveServerConfig(
    frpcServer: OpenSourceFrpcDesktopServer
  ): Promise<OpenSourceFrpcDesktopServer> {
    frpcServer._id = this._serverId;
    return await this._serverDao.updateById(this._serverId, frpcServer);
  }

  async getServerConfig(): Promise<OpenSourceFrpcDesktopServer> {
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

  async genTomlConfig(outputPath: string) {
    if (!outputPath) {
      return;
    }
    const server = await this.getServerConfig();
    const proxies = await this._proxyDao.findAll();
    const enabledProxies = proxies
      .filter(f => f.status === 1)
      .map(proxy => {
        const { _id, status, ...frpProxyConfig } = proxy;
        return frpProxyConfig;
      });
    const { frpcVersion, _id, system, ...commonConfig } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePath();
    const toml = TOML.stringify({ ...frpcConfig, proxies: enabledProxies });

    fs.writeFileSync(
      outputPath, // 配置文件目录
      toml, // 配置文件内容
      { flag: "w" }
    );
  }
}

export default ServerService;
