import BaseService from "./BaseService";
import ServerRepository from "../repository/ServerRepository";
import fs from "fs";
import PathUtils from "../utils/PathUtils";
import ProxyRepository from "../repository/ProxyRepository";
import SystemService from "./SystemService";
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
    proxyDao: ProxyRepository,
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
      .map(proxy => {
        const { _id, status, ...frpProxyConfig } = proxy;
        return frpProxyConfig;
      });
    const { frpcVersion, _id, system, ...commonConfig } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePath();
    frpcConfig.loginFailExit = false;
    frpcConfig.webServer.addr = "127.0.0.1";
    const toml = TOML.stringify({ ...frpcConfig, proxies: enabledProxies });

    fs.writeFileSync(
      outputPath, // 配置文件目录
      toml, // 配置文件内容
      { flag: "w" }
    );
  }

  async importTomlConfig() {
    const win: BrowserWindow = BeanFactory.getBean("win");
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        { name: "Frpc Toml ConfigFile", extensions: ["toml"] }
      ]
    });
    if (result.canceled) {

    }else {
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
