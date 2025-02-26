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

  private isRagePort(proxy: FrpcProxy) {
    return (
      ["tcp", "udp"].indexOf(proxy.type) >= 0 &&
      (String(proxy.localPort).indexOf("-") !== -1 ||
        String(proxy.localPort).indexOf(",") !== -1)
    );
  }

  private isVisitors(proxy: FrpcProxy) {
    return (
      ["stcp", "sudp", "xtcp"].indexOf(proxy.type) >= 0 &&
      proxy.visitorsModel === "visitors"
    );
  }

  private isEnableProxy(proxy: FrpcProxy) {
    return proxy.status === 1;
  }

  private isHttps2http(proxy: FrpcProxy) {
    return proxy.https2http;
  }

  async genTomlConfig(outputPath: string) {
    if (!outputPath) {
      return;
    }
    const server = await this.getServerConfig();
    const proxies = await this._proxyDao.findAll();

    const enabledRangePortProxies = proxies
      .filter(f => this.isEnableProxy(f))
      .filter(f => !this.isVisitors(f))
      .filter(f => this.isRagePort(f))
      .map(proxy => {
        return `
{{- range $_, $v := parseNumberRangePair "${proxy.localPort}" "${proxy.remotePort}" }}
[[proxies]]

type = "${proxy.type}"
name = "${proxy.name}-{{ $v.First }}"
localPort = {{ $v.First }}
remotePort = {{ $v.Second }}
{{- end }}
`;
      });

    const enabledProxies = proxies
      .filter(f => this.isEnableProxy(f))
      .filter(f => !this.isVisitors(f))
      .filter(f => !this.isRagePort(f))
      .map(proxy => {
        if (proxy.type === "tcp" || proxy.type === "udp") {
          const localPort = parseInt(proxy.localPort);
          const remotePort = parseInt(proxy.remotePort);
          return {
            name: proxy.name,
            type: proxy.type,
            localIP: proxy.localIP,
            localPort: localPort,
            remotePort: remotePort
          };
        } else if (proxy.type === "http" || proxy.type === "https") {
          if (this.isHttps2http(proxy) && proxy.type === "https") {
            return {
              name: proxy.name,
              type: proxy.type,
              customDomains: proxy.customDomains,
              subdomain: proxy.subdomain,
              ...(proxy.https2http
                ? {
                    plugin: {
                      type: "https2http",
                      localAddr: `${proxy.localIP}:${proxy.localPort}`,
                      crtPath: proxy.https2httpCaFile,
                      keyPath: proxy.https2httpKeyFile
                    }
                  }
                : {})
            };
          } else {
            return {
              name: proxy.name,
              type: proxy.type,
              localIP: proxy.localIP,
              localPort: parseInt(proxy.localPort),
              customDomains: proxy.customDomains,
              subdomain: proxy.subdomain,
              ...(proxy.basicAuth
                ? { httpUser: proxy.httpUser, httpPassword: proxy.httpPassword }
                : {})
            };
          }
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
      .filter(f => this.isEnableProxy(f))
      .filter(f => this.isVisitors(f))
      .map(proxy => {
        if (proxy.type === "xtcp") {
          return {
            name: proxy.name,
            type: proxy.type,
            // serverUser: proxy.serverUser,
            serverName: proxy.serverName,
            secretKey: proxy.secretKey,
            bindAddr: proxy.bindAddr,
            bindPort: proxy.bindPort,
            keepTunnelOpen: proxy.keepTunnelOpen,
            fallbackTo: proxy.fallbackTo,
            fallbackTimeoutMs: proxy.fallbackTimeoutMs
          };
        } else {
          return {
            name: proxy.name,
            type: proxy.type,
            serverName: proxy.serverName,
            secretKey: proxy.secretKey,
            bindAddr: proxy.bindAddr,
            bindPort: proxy.bindPort
          };
        }
      });

    const { frpcVersion, _id, system, ...commonConfig } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePath();
    frpcConfig.loginFailExit = GlobalConstant.FRPC_LOGIN_FAIL_EXIT;
    frpcConfig.webServer.addr = GlobalConstant.LOCAL_IP;

    let toml = TOML.stringify({
      ...frpcConfig,
      ...(enabledProxies.length > 0 ? { proxies: enabledProxies } : {}),
      ...(enableVisitors.length > 0 ? { visitors: enableVisitors } : {})
    });

    enabledRangePortProxies.forEach(f => {
      toml += `
${f}`;
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
