import { app, BrowserWindow, dialog } from "electron";
import fs from "fs";
import path from "path";
import TOML from "smol-toml";
import BeanFactory from "../core/BeanFactory";
import GlobalConstant from "../core/GlobalConstant";
import Logger from "../core/Logger";
import ProxyRepository from "../repository/ProxyRepository";
import ServerRepository from "../repository/ServerRepository";
import PathUtils from "../utils/PathUtils";
import BaseService from "./BaseService";

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
    frpcServer: OpenSourceFrpcDesktopServer,
    applySystemSettings = true
  ): Promise<OpenSourceFrpcDesktopServer> {
    if (!frpcServer._id) {
      frpcServer._id = this._serverId;
    }
    this.normalizeServerConfig(frpcServer);
    const newConfig = await this._serverDao.updateById(
      frpcServer._id,
      frpcServer
    );
    if (applySystemSettings && newConfig._id === this._serverId) {
      try {
        app.setLoginItemSettings({
          openAtLogin: newConfig.system.launchAtStartup || false, //win
          openAsHidden: newConfig.system.launchAtStartup || false //macOs
        });
      } catch (error) {
        Logger.error("ServerService.saveServerConfig", error);
      }
    }
    Logger.setLevel(newConfig.log.level);
    return newConfig;
  }

  async createServerConfig(
    frpcServer: OpenSourceFrpcDesktopServer
  ): Promise<OpenSourceFrpcDesktopServer> {
    const server = {
      ...this.createDefaultServerConfig(undefined, ""),
      ...frpcServer,
      _id: "",
      name: frpcServer.name || "未命名节点",
      remark: frpcServer.remark || "",
      isDefault: false
    };
    const newConfig = await this._serverDao.create(server);
    return this.normalizeServerConfig(newConfig);
  }

  async getServerConfig(): Promise<OpenSourceFrpcDesktopServer> {
    const config = await this._serverDao.findById(this._serverId);
    return this.normalizeServerConfig(
      config || this.createDefaultServerConfig()
    );
  }

  async getServerConfigById(id: string): Promise<OpenSourceFrpcDesktopServer> {
    const config = await this._serverDao.findById(id || this._serverId);
    return this.normalizeServerConfig(
      config || this.createDefaultServerConfig(undefined, id || this._serverId)
    );
  }

  async getServerConfigs(): Promise<Array<OpenSourceFrpcDesktopServer>> {
    const configs = await this._serverDao.findAll();
    if (!configs || configs.length === 0) {
      return [this.createDefaultServerConfig()];
    }
    return configs
      .map(config => this.normalizeServerConfig(config))
      .sort((a, b) => {
        if (a._id === this._serverId) return -1;
        if (b._id === this._serverId) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
  }

  async deleteServerConfig(id: string) {
    if (!id || id === this._serverId) {
      throw new Error("默认服务不能删除");
    }
    const proxies = await this._proxyDao.findAll();
    for (const proxy of proxies.filter(proxy => proxy.serverId === id)) {
      await this._proxyDao.updateById(proxy._id, {
        ...proxy,
        serverId: this._serverId
      });
    }
    await this._serverDao.deleteById(id);
  }

  hasServerConfig(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this._serverDao
        .exists(this._serverId)
        .then(async r => {
          if (r) {
            const config = await this.getServerConfig();
            resolve(!!config && !!config.serverAddr);
          } else {
            resolve(false);
          }
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

  private normalizeServerConfig(config: OpenSourceFrpcDesktopServer) {
    if (!config) {
      return config;
    }
    if (!config._id) config._id = this._serverId;
    if (!config.name) {
      config.name = config._id === this._serverId ? "默认节点" : "未命名节点";
    }
    if (config.remark === undefined) config.remark = "";
    config.isDefault = config._id === this._serverId;
    if (!config.system) {
      config.system = this.createDefaultServerConfig().system;
    }
    return config;
  }

  private createDefaultServerConfig(
    existingConfig?: OpenSourceFrpcDesktopServer,
    id = this._serverId
  ): OpenSourceFrpcDesktopServer {
    return {
      _id: id,
      multiuser: false,
      frpcVersion: existingConfig?.frpcVersion ?? null,
      name: id === this._serverId ? "默认节点" : "未命名节点",
      remark: "",
      isDefault: id === this._serverId,
      loginFailExit: false,
      udpPacketSize: 1500,
      serverAddr: "",
      serverPort: 7000,
      auth: {
        method: "",
        token: ""
      },
      log: {
        to: "",
        level: "info",
        maxDays: 3,
        disablePrintColor: false
      },
      transport: {
        dialServerTimeout: 10,
        dialServerKeepalive: 7200,
        poolCount: 0,
        tcpMux: true,
        tcpMuxKeepaliveInterval: 30,
        protocol: "tcp",
        connectServerLocalIP: "",
        proxyURL: "",
        tls: {
          enable: true,
          certFile: "",
          keyFile: "",
          trustedCaFile: "",
          serverName: "",
          disableCustomTLSFirstByte: true
        },
        heartbeatInterval: 30,
        heartbeatTimeout: 90
      },
      metadatas: {
        token: ""
      },
      webServer: {
        addr: "127.0.0.1",
        port: 57400,
        user: "",
        password: "",
        pprofEnable: false
      },
      system: {
        launchAtStartup: existingConfig?.system?.launchAtStartup || false,
        silentStartup: existingConfig?.system?.silentStartup || false,
        autoConnectOnStartup:
          existingConfig?.system?.autoConnectOnStartup || false,
        language:
          existingConfig?.system?.language || GlobalConstant.DEFAULT_LANGUAGE
      },
      user: ""
    };
  }

  private createDefaultProxy(visitorsModel = "visitorsProvider"): FrpcProxy {
    return {
      _id: "",
      serverId: this._serverId,
      hostHeaderRewrite: "",
      locations: [""],
      name: "",
      remark: "",
      type: "http",
      localIP: "",
      localPort: "8080",
      remotePort: "8080",
      customDomains: [""],
      visitorsModel,
      serverUser: "",
      serverName: "",
      secretKey: "",
      bindAddr: "",
      bindPort: null,
      subdomain: "",
      basicAuth: false,
      httpUser: "",
      httpPassword: "",
      fallbackTo: "",
      fallbackTimeoutMs: 500,
      https2http: false,
      https2httpCaFile: "",
      https2httpKeyFile: "",
      keepTunnelOpen: false,
      status: 1,
      transport: {
        useEncryption: false,
        useCompression: false,
        proxyProtocolVersion: ""
      }
    };
  }

  private applyTomlServerConfig(
    sourceConfig: Record<string, any>,
    config: OpenSourceFrpcDesktopServer
  ) {
    if (sourceConfig.loginFailExit !== undefined) {
      config.loginFailExit = sourceConfig.loginFailExit as boolean;
    }
    if (sourceConfig.udpPacketSize !== undefined) {
      config.udpPacketSize = sourceConfig.udpPacketSize as number;
    }
    if (sourceConfig.serverAddr !== undefined) {
      config.serverAddr = sourceConfig.serverAddr as string;
    }
    if (sourceConfig.serverPort !== undefined) {
      config.serverPort = sourceConfig.serverPort as number;
    }
    if (sourceConfig.user !== undefined) {
      config.user = sourceConfig.user as string;
    }

    if (sourceConfig.auth) {
      Object.assign(config.auth, sourceConfig.auth);
    }
    if (sourceConfig.log) {
      Object.assign(config.log, sourceConfig.log);
    }
    if (sourceConfig.transport) {
      Object.assign(config.transport, sourceConfig.transport);
      if (sourceConfig.transport.tls) {
        Object.assign(config.transport.tls, sourceConfig.transport.tls);
      }
    }
    if (sourceConfig.metadatas) {
      Object.assign(config.metadatas, sourceConfig.metadatas);
    }
    if (sourceConfig.webServer) {
      Object.assign(config.webServer, sourceConfig.webServer);
    }
  }

  private mapTomlProxy(proxy: Record<string, any>, visitorsModel: string) {
    const proxy2 = this.createDefaultProxy(visitorsModel);

    if (proxy.name !== undefined) proxy2.name = proxy.name as string;
    if (proxy.type !== undefined) proxy2.type = proxy.type as string;
    if (proxy.localIP !== undefined) proxy2.localIP = proxy.localIP as string;
    if (proxy.localPort !== undefined) {
      proxy2.localPort = proxy.localPort.toString();
    }
    if (proxy.remotePort !== undefined) {
      proxy2.remotePort = proxy.remotePort.toString();
    }
    if (proxy.customDomains !== undefined) {
      proxy2.customDomains = proxy.customDomains as string[];
    }
    if (proxy.subdomain !== undefined) {
      proxy2.subdomain = proxy.subdomain as string;
    }
    if (proxy.locations !== undefined) {
      proxy2.locations = proxy.locations as string[];
    }
    if (proxy.hostHeaderRewrite !== undefined) {
      proxy2.hostHeaderRewrite = proxy.hostHeaderRewrite as string;
    }
    if (proxy.httpUser !== undefined) {
      proxy2.httpUser = proxy.httpUser as string;
    }
    if (proxy.httpPassword !== undefined) {
      proxy2.httpPassword = proxy.httpPassword as string;
    }
    if (proxy.serverName !== undefined) {
      proxy2.serverName = proxy.serverName as string;
    }
    if (proxy.serverUser !== undefined) {
      proxy2.serverUser = proxy.serverUser as string;
    }
    if (proxy.secretKey !== undefined) {
      proxy2.secretKey = proxy.secretKey as string;
    }
    if (proxy.bindAddr !== undefined) {
      proxy2.bindAddr = proxy.bindAddr as string;
    }
    if (proxy.bindPort !== undefined) {
      proxy2.bindPort = proxy.bindPort as number;
    }
    if (proxy.fallbackTo !== undefined) {
      proxy2.fallbackTo = proxy.fallbackTo as string;
    }
    if (proxy.fallbackTimeoutMs !== undefined) {
      proxy2.fallbackTimeoutMs = proxy.fallbackTimeoutMs as number;
    }
    if (proxy.keepTunnelOpen !== undefined) {
      proxy2.keepTunnelOpen = proxy.keepTunnelOpen as boolean;
    }
    if (proxy.serverId !== undefined) {
      proxy2.serverId = proxy.serverId as string;
    }
    if (proxy.transport) {
      Object.assign(proxy2.transport, proxy.transport);
    }
    if (proxy.plugin?.type === "https2http") {
      proxy2.https2http = true;
      if (proxy.plugin.localAddr) {
        const localAddr = String(proxy.plugin.localAddr);
        const separatorIndex = localAddr.lastIndexOf(":");
        if (separatorIndex > -1) {
          proxy2.localIP = localAddr.slice(0, separatorIndex);
          proxy2.localPort = localAddr.slice(separatorIndex + 1);
        } else {
          proxy2.localIP = localAddr;
        }
      }
      if (proxy.plugin.crtPath !== undefined) {
        proxy2.https2httpCaFile = proxy.plugin.crtPath as string;
      }
      if (proxy.plugin.keyPath !== undefined) {
        proxy2.https2httpKeyFile = proxy.plugin.keyPath as string;
      }
    }

    return proxy2;
  }

  async syncTomlConfigFile(filePath: string) {
    if (!filePath || path.extname(filePath) !== GlobalConstant.TOML_EXT) {
      throw new Error(`导入失败，暂不支持 ${path.extname(filePath)} 格式文件`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`导入失败，文件不存在: ${filePath}`);
    }

    const sourceConfig = TOML.parse(
      fs.readFileSync(filePath, "utf-8")
    ) as Record<string, any> | null;
    if (!sourceConfig) {
      return {
        path: filePath,
        proxies: 0
      };
    }

    const proxies: Array<FrpcProxy> = [];
    if (Array.isArray(sourceConfig.proxies)) {
      proxies.push(
        ...sourceConfig.proxies.map(proxy =>
          this.mapTomlProxy(proxy, "visitorsProvider")
        )
      );
    }
    if (Array.isArray(sourceConfig.visitors)) {
      proxies.push(
        ...sourceConfig.visitors.map(visitor =>
          this.mapTomlProxy(visitor, "visitors")
        )
      );
    }

    const proxyMap = new Map<string, FrpcProxy>();
    proxies
      .filter(proxy => proxy.name && proxy.type)
      .forEach(proxy => {
        proxyMap.set(`${proxy.name}\u0000${proxy.type}`, proxy);
      });
    const validProxies = Array.from(proxyMap.values());

    const config = this.createDefaultServerConfig(await this.getServerConfig());
    this.applyTomlServerConfig(sourceConfig, config);
    await this.saveServerConfig(config, false);

    validProxies.forEach(proxy => {
      proxy.serverId = config._id;
    });

    await this._proxyDao.truncate();
    if (validProxies.length > 0) {
      await this._proxyDao.insertMany(validProxies);
    }

    return {
      path: filePath,
      proxies: validProxies.length,
      replaced: true
    };
  }

  private async getServerRuntimeIndex(serverId: string) {
    const servers = await this.getServerConfigs();
    const index = servers.findIndex(server => server._id === serverId);
    return index < 0 ? 0 : index;
  }

  private async getServerWebPort(server: OpenSourceFrpcDesktopServer) {
    const basePort = server.webServer?.port || 57400;
    return basePort + (await this.getServerRuntimeIndex(server._id));
  }

  async getServerRuntimeWebPort(server: OpenSourceFrpcDesktopServer) {
    return this.getServerWebPort(server);
  }

  private isProxyAssignedToServer(proxy: FrpcProxy, serverId: string) {
    const proxyServerId = proxy.serverId || this._serverId;
    return proxyServerId === serverId;
  }

  async getRunnableServerConfigs() {
    const servers = await this.getServerConfigs();
    const proxies = await this._proxyDao.findAll();
    const enabledServerIds = new Set(
      proxies
        .filter(proxy => this.isEnableProxy(proxy))
        .map(proxy => proxy.serverId || this._serverId)
    );
    return servers.filter(server => enabledServerIds.has(server._id));
  }

  async genTomlConfig(outputPath: string, serverId = this._serverId) {
    if (!outputPath) {
      return;
    }
    const server = await this.getServerConfigById(serverId);
    const proxies = (await this._proxyDao.findAll()).filter(proxy =>
      this.isProxyAssignedToServer(proxy, server._id)
    );

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
localIP = "${proxy.localIP}"
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
            remotePort: remotePort,
            transport: proxy.transport
          };
        } else if (proxy.type === "http" || proxy.type === "https") {
          if (this.isHttps2http(proxy) && proxy.type === "https") {
            return {
              name: proxy.name,
              type: proxy.type,
              customDomains: proxy.customDomains,
              subdomain: proxy.subdomain,
              transport: proxy.transport,
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
              transport: proxy.transport,
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
            transport: proxy.transport,
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
            serverName: proxy.serverName,
            secretKey: proxy.secretKey,
            bindAddr: proxy.bindAddr,
            bindPort: proxy.bindPort,
            ...(proxy.serverUser ? { serverUser: proxy.serverUser } : {}),
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
            bindPort: proxy.bindPort,
            ...(proxy.serverUser ? { serverUser: proxy.serverUser } : {})
          };
        }
      });

    const {
      frpcVersion,
      _id,
      system,
      multiuser,
      name,
      remark,
      isDefault,
      ...commonConfig
    } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePathByServerId(server._id);
    frpcConfig.loginFailExit = GlobalConstant.FRPC_LOGIN_FAIL_EXIT;
    frpcConfig.webServer.addr = GlobalConstant.LOCAL_IP;
    frpcConfig.webServer.port = await this.getServerWebPort(server);

    if (frpcConfig.auth.method === "none") {
      frpcConfig.auth = null;
    }

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
      return {
        canceled: true,
        path: ""
      };
    }

    const filePath = result.filePaths[0];
    const importResult = await this.syncTomlConfigFile(filePath);
    return {
      canceled: false,
      ...importResult
    };
  }

  async isSilentStart() {
    const serverConfig = await this.getServerConfig();
    if (serverConfig) {
      return serverConfig.system.silentStartup;
    } else {
      return false;
    }
  }

  async isAutoConnectOnStartup() {
    const serverConfig = await this.getServerConfig();
    if (serverConfig) {
      return serverConfig.system.autoConnectOnStartup;
    } else {
      return false;
    }
  }

  async getLoggerLevel() {
    const serverConfig = await this.getServerConfig();
    if (serverConfig) {
      return serverConfig.log.level;
    } else {
      return "info";
    }
  }

  async getLanguage() {
    const serverConfig = await this.getServerConfig();
    let language = undefined;
    if (serverConfig) {
      language = serverConfig.system.language;
    }
    if (!language) {
      language = GlobalConstant.DEFAULT_LANGUAGE;
    }
    return language;
  }

  async saveLanguage(language: string) {
    let serverConfig = await this.getServerConfig();
    if (!serverConfig) {
      serverConfig = {
        _id: "",
        multiuser: false,
        frpcVersion: null,
        name: "默认节点",
        remark: "",
        isDefault: true,
        loginFailExit: false,
        udpPacketSize: 1500,
        serverAddr: "",
        serverPort: 7000,
        auth: {
          method: "",
          token: ""
        },
        log: {
          to: "",
          level: "info",
          maxDays: 3,
          disablePrintColor: false
        },
        transport: {
          dialServerTimeout: 10,
          dialServerKeepalive: 7200,
          poolCount: 0,
          tcpMux: true,
          tcpMuxKeepaliveInterval: 30,
          protocol: "tcp",
          connectServerLocalIP: "",
          proxyURL: "",
          tls: {
            enable: true,
            certFile: "",
            keyFile: "",
            trustedCaFile: "",
            serverName: "",
            disableCustomTLSFirstByte: true
          },
          heartbeatInterval: 30,
          heartbeatTimeout: 90
        },
        metadatas: {
          token: ""
        },
        webServer: {
          addr: "127.0.0.1",
          port: 57400,
          user: "",
          password: "",
          pprofEnable: false
        },
        system: {
          launchAtStartup: false,
          silentStartup: false,
          autoConnectOnStartup: false,
          language: language
        },
        user: ""
      };
    } else {
      serverConfig.system.language = language;
    }
    await this.saveServerConfig(serverConfig);
  }
}

export default ServerService;
