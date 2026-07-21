import ProxyRepository from "../repository/ProxyRepository";
import ServerRepository from "../repository/ServerRepository";
import FrpcProcessService from "./FrpcProcessService";
import { exec } from "child_process";
import Logger from "../core/Logger";
import http from "node:http";
import https from "node:https";
import { Socket } from "node:net";

type ProxyProbeTarget = {
  kind: "http" | "tcp";
  target: string;
  url?: string;
  host?: string;
  port?: number;
};

const PROXY_REACHABILITY_TIMEOUT_MS = 8000;

class ProxyService {
  private readonly _proxyDao: ProxyRepository;
  private readonly _serverDao: ServerRepository;
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(
    public proxyDao: ProxyRepository,
    serverDao: ServerRepository,
    frpcProcessService: FrpcProcessService
  ) {
    this._proxyDao = proxyDao;
    this._serverDao = serverDao;
    this._frpcProcessService = frpcProcessService;
  }

  private syncRunnableFrpcProcessesInBackground() {
    this._frpcProcessService
      .syncRunnableFrpcProcesses()
      .catch((error: Error) =>
        Logger.error(
          "ProxyService.syncRunnableFrpcProcessesInBackground",
          error
        )
      );
  }

  async insertProxy(proxy: FrpcProxy) {
    const proxy2 = await this._proxyDao.insert(proxy);
    this.syncRunnableFrpcProcessesInBackground();
    return proxy2;
  }

  async updateProxy(proxy: FrpcProxy) {
    const proxy2 = await this._proxyDao.updateById(proxy._id, proxy);
    this.syncRunnableFrpcProcessesInBackground();
    return proxy2;
  }

  async updateProxyStatus(id: string, status: number) {
    await this._proxyDao.updateProxyStatus(id, status);
    this.syncRunnableFrpcProcessesInBackground();
  }

  async deleteProxy(proxyId: string) {
    await this._proxyDao.deleteById(proxyId);
    this.syncRunnableFrpcProcessesInBackground();
  }

  private getProxyServer(
    proxy: FrpcProxy,
    servers: Array<OpenSourceFrpcDesktopServer>
  ) {
    const serverId = proxy.serverId || "1";
    return (
      servers.find(server => server._id === serverId) ||
      servers.find(server => server._id === "1")
    );
  }

  private getFirstCustomDomain(proxy: FrpcProxy) {
    return (proxy.customDomains || [])
      .map(domain => String(domain || "").trim())
      .find(Boolean);
  }

  private getProbeTarget(
    proxy: FrpcProxy,
    server?: OpenSourceFrpcDesktopServer
  ): ProxyProbeTarget | null {
    if (proxy.type === "http" || proxy.type === "https") {
      const domain = this.getFirstCustomDomain(proxy);
      if (!domain) {
        return null;
      }
      const url = domain.startsWith("http://") || domain.startsWith("https://")
        ? domain
        : `${proxy.type}://${domain}`;
      return {
        kind: "http",
        target: url,
        url
      };
    }

    if (proxy.type === "tcp") {
      const host = server?.serverAddr;
      const port = Number(proxy.remotePort);
      if (!host || !Number.isFinite(port)) {
        return null;
      }
      return {
        kind: "tcp",
        target: `${host}:${port}`,
        host,
        port
      };
    }

    return null;
  }

  private probeHttp(url: string) {
    const startedAt = Date.now();
    return new Promise<Pick<
      ProxyReachabilityResult,
      "state" | "statusCode" | "elapsedMs" | "message"
    >>(resolve => {
      const transport = url.startsWith("https://") ? https : http;
      const req = transport.request(
        url,
        {
          method: "GET",
          timeout: PROXY_REACHABILITY_TIMEOUT_MS,
          rejectUnauthorized: false,
          headers: {
            "User-Agent": "Frpc-Desktop reachability check"
          }
        },
        response => {
          response.resume();
          const statusCode = response.statusCode || 0;
          resolve({
            state: statusCode >= 500 ? "offline" : "online",
            statusCode,
            elapsedMs: Date.now() - startedAt,
            message:
              statusCode >= 500
                ? `HTTP ${statusCode}`
                : `HTTP ${statusCode || "OK"}`
          });
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error("timeout"));
      });

      req.on("error", error => {
        resolve({
          state: "offline",
          elapsedMs: Date.now() - startedAt,
          message: error.message || "connection failed"
        });
      });

      req.end();
    });
  }

  private probeTcp(host: string, port: number) {
    const startedAt = Date.now();
    return new Promise<Pick<
      ProxyReachabilityResult,
      "state" | "elapsedMs" | "message"
    >>(resolve => {
      const socket = new Socket();
      let settled = false;
      const finish = (
        result: Pick<
          ProxyReachabilityResult,
          "state" | "elapsedMs" | "message"
        >
      ) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(PROXY_REACHABILITY_TIMEOUT_MS);
      socket.once("connect", () => {
        finish({
          state: "online",
          elapsedMs: Date.now() - startedAt,
          message: "TCP connected"
        });
      });
      socket.once("timeout", () => {
        finish({
          state: "offline",
          elapsedMs: Date.now() - startedAt,
          message: "TCP timeout"
        });
      });
      socket.once("error", error => {
        finish({
          state: "offline",
          elapsedMs: Date.now() - startedAt,
          message: error.message || "TCP connection failed"
        });
      });
      socket.connect(port, host);
    });
  }

  async getProxyReachability(): Promise<Array<ProxyReachabilityResult>> {
    const [proxies, servers] = await Promise.all([
      this._proxyDao.findAll(),
      this._serverDao.findAll()
    ]);
    const checkedAt = Date.now();

    return Promise.all(
      proxies.map(async proxy => {
        const server = this.getProxyServer(proxy, servers || []);
        const base = {
          proxyId: proxy._id,
          proxyName: proxy.name,
          proxyRemark: proxy.remark || "",
          serverId: proxy.serverId || "1",
          checkedAt
        };

        if (proxy.status !== 1) {
          return {
            ...base,
            target: "",
            state: "disabled",
            elapsedMs: 0,
            message: "proxy disabled"
          };
        }

        const target = this.getProbeTarget(proxy, server);
        if (!target) {
          return {
            ...base,
            target: "",
            state: "unknown",
            elapsedMs: 0,
            message: "no supported external probe target"
          };
        }

        const result =
          target.kind === "http"
            ? await this.probeHttp(target.url)
            : await this.probeTcp(target.host, target.port);

        return {
          ...base,
          target: target.target,
          ...result
        };
      })
    );
  }

  async getLocalPorts(): Promise<Array<LocalPort>> {
    const command =
      process.platform === "win32"
        ? "netstat -a -n"
        : "netstat -an | grep LISTEN";
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        }
        if (stderr) {
          reject(stderr);
        }
        let ports: Array<LocalPort> = [];
        if (stdout) {
          if (process.platform === "win32") {
            // window
            ports = stdout
              .split("\r\n")
              .filter(f => f.indexOf("TCP") !== -1 || f.indexOf("UDP") !== -1)
              .map(m => {
                const cols = m.split(" ").filter(f => f != "");
                const local = cols[1];
                const s = local.lastIndexOf(":");
                const localIP = local.slice(0, s);
                const localPort = local.slice(s - local.length + 1);
                const singe: LocalPort = {
                  protocol: cols[0],
                  ip: localIP,
                  port: parseInt(localPort)
                };

                return singe;
              });
          } else if (process.platform === "darwin") {
            // mac
            ports = stdout
              .split("\n")
              .filter(m => {
                const cols = m.split(" ").filter(f => f != "");
                const local = cols[3];
                return local;
              })
              .map(m => {
                const cols = m.split(" ").filter(f => f != "");
                const local = cols[3];
                const s = local.lastIndexOf(".");
                const localIP = local.slice(0, s);
                const localPort = local.slice(s - local.length + 1);
                const singe: LocalPort = {
                  protocol: cols[0],
                  ip: localIP,
                  port: parseInt(localPort)
                };
                return singe;
              });
          } else if (process.platform === "linux") {
            ports = stdout
              .split("\n")
              .filter(
                f =>
                  f.indexOf("tcp") !== -1 ||
                  f.indexOf("tcp6") !== -1 ||
                  f.indexOf("udp") !== -1 ||
                  f.indexOf("udp6") !== -1
              )
              .map(m => {
                const cols = m.split(" ").filter(f => f != "");
                const local = cols[3];
                const s = local.lastIndexOf(":");
                const localIP = local.slice(0, s);
                const localPort = local.slice(s - local.length + 1);
                const singe: LocalPort = {
                  protocol: cols[0],
                  ip: localIP,
                  port: parseInt(localPort)
                };
                return singe;
              });
          }
        }

        ports.sort((a, b) => a.port - b.port);

        resolve(ports);
      });
      // exec(command, (error, stdout, stderr) => {
      //   if (error) {
      //     logError(LogModule.APP, `getLocalPorts - error: ${error.message}`);
      //     return;
      //   }
      //   if (stderr) {
      //     logWarn(LogModule.APP, `getLocalPorts - stderr: ${stderr}`);
      //     return;
      //   }
      //
      //   logDebug(LogModule.APP, `Command output: ${stdout}`);
      //   let ports = [];

      //
      //   event.reply("local.getLocalPorts.hook", {
      //     data: ports
      //   });
      // });
    });
  }
}

export default ProxyService;
