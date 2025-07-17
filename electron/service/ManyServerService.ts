import ProxyRepository from "electron/repository/ProxyRepository";
import _ from "lodash";
import ManyServerRepository from "../repository/ManyServerRepository";
import VersionRepository from "../repository/VersionRepository";
import BaseService from "./BaseService";
import ServerService from "./ServerService";

class ManyServerService extends BaseService<FrpcDesktopServer> {
  private readonly _manyServerRepository: ManyServerRepository;
  private readonly _versionRepository: VersionRepository;
  private readonly _serverService: ServerService;
  private readonly _proxyDao: ProxyRepository;

  constructor(
    manyServerRepository: ManyServerRepository,
    versionRepository: VersionRepository
  ) {
    super();
    this._manyServerRepository = manyServerRepository;
    this._versionRepository = versionRepository;
  }

  async insertServer(server: FrpcDesktopServer) {
    const server2 = await this._manyServerRepository.insert(server);
    return server2;
  }

  async updateServer(server: FrpcDesktopServer) {
    const server2 = await this._manyServerRepository.updateById(
      server._id,
      server
    );
    return server2;
  }

  async deleteServer(serverId: string) {
    await this._manyServerRepository.deleteById(serverId);
  }

  async getAllServer() {
    const servers = await this._manyServerRepository.findAll();
    const versions = await this._versionRepository.findAll();
    return servers.map(m => {
      const version = versions.find(v => v.githubReleaseId === m.frpcVersion);
      const vo: any = _.cloneDeep(m);
      vo.frpcVersionName = version?.name;
      return vo;
    });
  }

  private isEnableProxy(proxy: FrpcProxy) {
    return proxy.status === 1;
  }

  private isHttps2http(proxy: FrpcProxy) {
    return proxy.https2http;
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

  async genTomlConfig(serverId: string, outputPath: string) {
    if (!outputPath) {
      return;
    }
    const config = await this._serverService.getServerConfig();
    const server = await this._manyServerRepository.findByServerId(serverId);
    const proxies = await this._proxyDao.findByServerId(serverId);

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
            remotePort: remotePort,
            transport: proxy.transport
          };
        } else if (proxy.type === "http" || proxy.type === "https") {
          const locations = proxy.locations.filter(l => l !== "");
          if (this.isHttps2http(proxy) && proxy.type === "https") {
            return {
              name: proxy.name,
              type: proxy.type,
              customDomains: proxy.customDomains,
              subdomain: proxy.subdomain,
              transport: proxy.transport,
              ...(locations.length > 0 ? { locations } : {}),
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
              ...(locations.length > 0 ? { locations } : {}),
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

    const { frpcVersion, _id, system, multiuser, ...commonConfig } = server;
    const frpcConfig = { ...commonConfig };
    frpcConfig.log.to = PathUtils.getFrpcLogFilePath();
    frpcConfig.loginFailExit = GlobalConstant.FRPC_LOGIN_FAIL_EXIT;
    frpcConfig.webServer.addr = GlobalConstant.LOCAL_IP;

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
}

export default ManyServerService;
