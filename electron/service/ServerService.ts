import BaseService from "./BaseService";
import ServerRepository from "../repository/ServerRepository";
import fs from "fs";
import PathUtils from "../utils/PathUtils";
import ProxyRepository from "../repository/ProxyRepository";
import { BrowserWindow, dialog } from "electron";
import BeanFactory from "../core/BeanFactory";
import path from "path";
import GlobalConstant from "../core/GlobalConstant";
import TOML from "smol-toml";

class ServerService extends BaseService<OpenSourceFrpcDesktopServer> {
  private readonly _serverDao: ServerRepository;
  private readonly _proxyDao: ProxyRepository;
  // private readonly _systemService: SystemService;
  private readonly _serverId: string = "1";

  constructor(
    serverDao: ServerRepository,
    proxyDao: ProxyRepository
    // systemService: SystemService
  ) {
    super();
    this._serverDao = serverDao;
    this._proxyDao = proxyDao;
    // this._systemService = systemService;
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
      .filter(f => f.visitorsModel !== "visitors")
      .map(proxy => {
        if (proxy.type === "tcp" || proxy.type === "udp") {
          return {
            name: proxy.name,
            type: proxy.type,
            localIP: proxy.localIP,
            localPort: parseInt(proxy.localPort),
            remotePort: parseInt(proxy.remotePort)
          };
        } else if (proxy.type === "http" || proxy.type === "https") {
          const { _id, status, ...frpProxyConfig } = proxy;
          return frpProxyConfig;
        } else if (
          proxy.type === "stcp" ||
          proxy.type === "xtcp" ||
          proxy.type === "sudp"
        ) {
          return {
            name: proxy.name,
            type: proxy.type,
            localIP: proxy.localIP,
            localPort: parseInt(proxy.localPort),
            secretKey: proxy.secretKey
          };
        }
      });

    const enableVisitors = proxies
      .filter(f => f.status === 1)
      .filter(f => f.visitorsModel === "visitors")
      .map(proxy => {
        return {
          name: proxy.name,
          type: proxy.type,
          // serverUser: proxy.serverUser,
          serverName: proxy.serverName,
          secretKey: proxy.secretKey,
          bindAddr: proxy.bindAddr,
          bindPort: proxy.bindPort,
          // keepTunnelOpen: proxy.keepTunnelOpen
          // maxRetriesAnHour: proxy.maxRetriesAnHour,
          // minRetryInterval: proxy.minRetryInterval,
        };
      });

    const { frpcVersion, _id, system, ...commonConfig } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePath();
    frpcConfig.loginFailExit = GlobalConstant.FRPC_LOGIN_FAIL_EXIT;
    frpcConfig.webServer.addr = GlobalConstant.LOCAL_IP;
    const toml = TOML.stringify({
      ...frpcConfig,
      proxies: enabledProxies,
      visitors: enableVisitors
    });

    fs.writeFileSync(outputPath, toml, { flag: "w" });
  }

  async importTomlConfig() {
    const win: BrowserWindow = BeanFactory.getBean("win");
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Frpc Toml ConfigFile", extensions: ["toml"] }]
    });
    if (result.canceled) {
    } else {
      const filePath = result.filePaths[0];
      const fileExtension = path.extname(filePath);
      if (fileExtension === GlobalConstant.TOML_EXT) {
        const tomlData = fs.readFileSync(filePath, "utf-8");
        const sourceConfig = TOML.parse(tomlData);
      } else {
        throw new Error(`导入失败，暂不支持 ${fileExtension} 格式文件`);
      }
      return;
    }
  }
}

export default ServerService;
