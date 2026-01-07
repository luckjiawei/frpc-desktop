import "reflect-metadata";
import ProxiesRepository from "../repository/ProxyRepository";
import FrpcProcessService from "./FrpcProcessService";
import { exec } from "child_process";
import ProxyConverter from "electron/converter/proxies";
import { injectable, inject } from "inversify";
import { TYPES } from "../di";

@injectable()
export default class ProxiesService {
  @inject(TYPES.ProxiesRepository)
  private readonly _proxyDao: ProxiesRepository;
  @inject(TYPES.FrpcProcessService)
  private readonly _frpcProcessService: FrpcProcessService;
  @inject(TYPES.ProxyConverter)
  private readonly _proxyConverter: ProxyConverter;

  constructor() { }

  /**
   * Insert a new proxy configuration
   * @param proxy The proxy configuration to insert
   * @returns The inserted proxy configuration
   */
  async insertProxy(proxy: FrpcDesktopProxy) {
    // insert proxy
    const model: ProxiesModel = this._proxyConverter.frpcDesktopProxy2Model(proxy);
    const proxy2 = await this._proxyDao.insert(model);
    // reload
    await this._frpcProcessService.reloadFrpcProcess();
    return proxy2;
  }

  /**
   * Update an existing proxy configuration
   * @param proxy The proxy configuration to update
   * @returns The updated proxy configuration
   */
  async updateProxy(proxy: FrpcDesktopProxy) {
    const model: ProxiesModel = this._proxyConverter.frpcDesktopProxy2Model(proxy);
    const proxy2 = await this._proxyDao.updateById(model);
    // reload
    await this._frpcProcessService.reloadFrpcProcess();
    return proxy2;
  }

  /**
   * Delete a proxy configuration by ID
   * @param proxyId The ID of the proxy configuration to delete
   */
  async deleteProxy(proxyId: number) {
    await this._proxyDao.deleteById(proxyId);
    // reload
    await this._frpcProcessService.reloadFrpcProcess();
  }

  /**
   * Get all local ports that are currently in use
   * @returns Array of local ports
   */
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
    });
  }

  async getAllProxies(): Promise<Array<FrpcDesktopProxy>> {
    const proxies = await this._proxyDao.selectAll();
    return proxies.map(m => this._proxyConverter.model2FrpcDesktopProxy(m));
  }
}

