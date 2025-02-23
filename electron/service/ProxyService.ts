import ProxyDao from "../dao/ProxyDao";

const { exec, spawn } = require("child_process");

class ProxyService {
  private readonly _proxyDao: ProxyDao;

  constructor(proxyDao: ProxyDao) {
    this._proxyDao = proxyDao;
  }

  async insertProxy(proxy: FrpcProxy) {
    return await this._proxyDao.insert(proxy);
  }

  async updateProxy(proxy: FrpcProxy) {
    return await this._proxyDao.updateById(proxy._id, proxy);
  }

  async deleteProxy(proxyId: string) {
    return await this._proxyDao.deleteById(proxyId);
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
                let localIP = local.slice(0, s);
                let localPort = local.slice(s - local.length + 1);
                const singe: LocalPort = {
                  protocol: cols[0],
                  ip: localIP,
                  port: localPort
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
                let localIP = local.slice(0, s);
                let localPort = local.slice(s - local.length + 1);
                const singe: LocalPort = {
                  protocol: cols[0],
                  ip: localIP,
                  port: localPort
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
                let localIP = local.slice(0, s);
                let localPort = local.slice(s - local.length + 1);
                const singe: LocalPort = {
                  protocol: cols[0],
                  ip: localIP,
                  port: localPort
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
