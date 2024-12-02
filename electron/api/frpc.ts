import { app, ipcMain, Notification } from "electron";
import { getConfig } from "../storage/config";
import { listProxy } from "../storage/proxy";
import { getVersionById } from "../storage/version";
import treeKill from "tree-kill";

const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const log = require("electron-log");
export let frpcProcess = null;
const runningCmd = {
  commandPath: null,
  configPath: null
};
let frpcStatusListener = null;

/**
 * 获取选择版本的工作目录
 * @param versionId 版本ID
 * @param callback
 */
const getFrpcVersionWorkerPath = (
  versionId: number,
  callback: (workerPath: string) => void
) => {
  getVersionById(versionId, (err2, version) => {
    if (!err2) {
      if (version) {
        callback(version["frpcVersionPath"]);
      }
    }
  });
};

const isRangePort = (m: Proxy) => {
  return (
    (m.type === "tcp" || m.type === "udp") &&
    (String(m.localPort).indexOf("-") !== -1 ||
      String(m.localPort).indexOf(",") !== -1)
  );
};

/**
 * 生成toml配置文件
 * @param config
 * @param proxys
 */
export const genTomlConfig = (config: FrpConfig, proxys: Proxy[]) => {
  const proxyToml = proxys.map(m => {
    const rangePort = isRangePort(m);
    let toml = `
${
  rangePort
    ? `{{- range $_, $v := parseNumberRangePair "${m.localPort}" "${m.remotePort}" }}`
    : ""
}
[[${
      (m.type === "stcp" || m.type === "xtcp" || m.type === "sudp") &&
      m.stcpModel === "visitors"
        ? "visitors"
        : "proxies"
    }]]
${rangePort ? "" : `name = "${m.name}"\n`}
type = "${m.type}"
`;

    switch (m.type) {
      case "tcp":
      case "udp":
        if (rangePort) {
          toml += `
name = "${m.name}-{{ $v.First }}"
localPort = {{ $v.First }}
remotePort = {{ $v.Second }}
          `;
        } else {
          toml += `
localIP = "${m.localIp}"
localPort = ${m.localPort}
remotePort = ${m.remotePort}
`;
        }
        break;
      case "http":
      case "https":
        toml += `
localIP = "${m.localIp}"
localPort = ${m.localPort}
customDomains=[${m.customDomains.map(m => `"${m}"`)}]
subdomain="${m.subdomain}"
`;
        if (m.basicAuth) {
          toml += `
httpUser = "${m.httpUser}"
httpPassword = "${m.httpPassword}"
`;
        }
        break;
      case "stcp":
      case "xtcp":
      case "sudp":
        if (m.stcpModel === "visitors") {
          // 访问者
          toml += `
serverName = "${m.serverName}"
bindAddr = "${m.bindAddr}"
bindPort = ${m.bindPort}
`;
          if (m.fallbackTo) {
            toml += `
fallbackTo = "${m.fallbackTo}"
fallbackTimeoutMs = ${m.fallbackTimeoutMs || 500}
            `;
          }
        } else if (m.stcpModel === "visited") {
          // 被访问者
          toml += `
localIP = "${m.localIp}"
localPort = ${m.localPort}`;
        }
        toml += `
secretKey="${m.secretKey}"
`;
        break;
      default:
        break;
    }

    if (rangePort) {
      toml += `{{- end }}`;
    }
    return toml;
  });
  const toml = `
serverAddr = "${config.serverAddr}"
serverPort = ${config.serverPort}
${
  config.authMethod === "token"
    ? `
auth.method = "token"
auth.token = "${config.authToken}"
`
    : ""
}
${
  config.authMethod === "multiuser"
    ? `
user = "${config.user}"
metadatas.token = "${config.metaToken}"
`
    : ""
}
${
  config.transportHeartbeatInterval
    ? `
transport.heartbeatInterval = ${config.transportHeartbeatInterval}
`
    : ""
}
${
  config.transportHeartbeatTimeout
    ? `
transport.heartbeatTimeout = ${config.transportHeartbeatTimeout}
`
    : ""
}


log.to = "frpc.log"
log.level = "${config.logLevel}"
log.maxDays = ${config.logMaxDays}
webServer.addr = "127.0.0.1"
webServer.port = ${config.webPort}
transport.tls.enable = ${config.tlsConfigEnable}
${
  config.tlsConfigEnable && config.tlsConfigCertFile
    ? `
transport.tls.certFile = "${config.tlsConfigCertFile}"
`
    : ""
}
  ${
    config.tlsConfigEnable && config.tlsConfigKeyFile
      ? `
transport.tls.keyFile = "${config.tlsConfigKeyFile}"
`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigTrustedCaFile
      ? `
transport.tls.trustedCaFile = "${config.tlsConfigTrustedCaFile}"
`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigServerName
      ? `
transport.tls.serverName = "${config.tlsConfigServerName}"
`
      : ""
  }
  

${
  config.proxyConfigEnable
    ? `
transport.proxyURL = "${config.proxyConfigProxyUrl}"
`
    : ""
}

${proxyToml.join("")}
      `;
  return toml;
};

/**
 * 生成ini配置
 * @param config
 * @param proxys
 */
export const genIniConfig = (config: FrpConfig, proxys: Proxy[]) => {
  const proxyIni = proxys.map(m => {
    const rangePort = isRangePort(m);
    let ini = `
[${rangePort ? "range:" : ""}${m.name}]
type = "${m.type}"
`;
    switch (m.type) {
      case "tcp":
      case "udp":
        ini += `
local_ip = "${m.localIp}"
local_port = ${m.localPort}
remote_port = ${m.remotePort}
`;
        break;
      case "http":
      case "https":
        ini += `
local_ip = "${m.localIp}"
local_port = ${m.localPort}
custom_domains=[${m.customDomains.map(m => `"${m}"`)}]
subdomain="${m.subdomain}"
`;
        if (m.basicAuth) {
          ini += `
httpUser = "${m.httpUser}"
httpPassword = "${m.httpPassword}"
`;
        }
        break;
      case "stcp":
      case "xtcp":
      case "sudp":
        if (m.stcpModel === "visitors") {
          // 访问者
          ini += `
role = visitor
server_name = "${m.serverName}"
bind_addr = "${m.bindAddr}"
bind_port = ${m.bindPort}
`;
          if (m.fallbackTo) {
            ini += `
fallback_to = ${m.fallbackTo}
fallback_timeout_ms = ${m.fallbackTimeoutMs || 500}
            `;
          }
        } else if (m.stcpModel === "visited") {
          // 被访问者
          ini += `
local_ip = "${m.localIp}"
local_port = ${m.localPort}`;
        }
        ini += `
sk="${m.secretKey}"
`;
        break;
      default:
        break;
    }

    return ini;
  });
  const ini = `
[common]
server_addr = ${config.serverAddr}
server_port = ${config.serverPort}
${
  config.authMethod === "token"
    ? `
authentication_method = ${config.authMethod}
token = ${config.authToken}
`
    : ""
}
${
  config.authMethod === "multiuser"
    ? `
user = ${config.user}
meta_token = ${config.metaToken}
`
    : ""
}

${
  config.transportHeartbeatInterval
    ? `
heartbeat_interval = ${config.transportHeartbeatInterval}
`
    : ""
}
${
  config.transportHeartbeatTimeout
    ? `
heartbeat_timeout = ${config.transportHeartbeatTimeout}
`
    : ""
}

log_file = "frpc.log"
log_level = ${config.logLevel}
log_max_days = ${config.logMaxDays}
admin_addr = 127.0.0.1
admin_port = ${config.webPort}
tls_enable = ${config.tlsConfigEnable}

${
  config.tlsConfigEnable && config.tlsConfigCertFile
    ? `
tls_cert_file = ${config.tlsConfigCertFile}
`
    : ""
}
  ${
    config.tlsConfigEnable && config.tlsConfigKeyFile
      ? `
tls_key_file = ${config.tlsConfigKeyFile}
`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigTrustedCaFile
      ? `
tls_trusted_ca_file = ${config.tlsConfigTrustedCaFile}
`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigServerName
      ? `
tls_server_name = ${config.tlsConfigServerName}
`
      : ""
  }

${
  config.proxyConfigEnable
    ? `
http_proxy = "${config.proxyConfigProxyUrl}"
`
    : ""
}

${proxyIni.join("")}
    `;
  return ini;
};

/**
 * 生成配置文件
 */
export const generateConfig = (
  config: FrpConfig,
  callback: (configPath: string) => void
) => {
  listProxy((err3, proxys) => {
    if (!err3) {
      const { currentVersion } = config;
      let filename = null;
      let configContent = "";
      const filtered = proxys
        .map(m => {
          if (m.status == null || m.status == undefined) {
            m.status = true;
          }
          return m;
        })
        .filter(f => f.status);
      if (currentVersion < 124395282) {
        // 版本小于v0.52.0
        filename = "frp.ini";
        configContent = genIniConfig(config, filtered);
      } else {
        filename = "frp.toml";
        configContent = genTomlConfig(config, filtered);
      }
      const configPath = path.join(app.getPath("userData"), filename);
      log.info(`生成配置成功 配置路径：${configPath}`);
      fs.writeFile(
        configPath, // 配置文件目录
        configContent, // 配置文件内容
        { flag: "w" },
        err => {
          if (!err) {
            callback(filename);
          }
        }
      );
    }
  });
};

/**
 * 启动frpc子进程
 * @param cwd
 * @param commandPath
 * @param configPath
 */
const startFrpcProcess = (commandPath: string, configPath: string) => {
  log.info(`启动frpc 目录：${app.getPath("userData")} 命令：${commandPath}`);
  const command = `${commandPath} -c ${configPath}`;
  frpcProcess = spawn(command, {
    cwd: app.getPath("userData"),
    shell: true
  });
  runningCmd.commandPath = commandPath;
  runningCmd.configPath = configPath;
  frpcProcess.stdout.on("data", data => {
    log.debug(`启动输出：${data}`);
  });
  frpcProcess.stdout.on("error", data => {
    log.error(`启动错误：${data}`);
    stopFrpcProcess(() => {});
  });
  frpcStatusListener = setInterval(() => {
    const status = frpcProcessStatus();
    log.debug(`监听frpc子进程状态：${status} ${frpcStatusListener}`);
    if (!status) {
      new Notification({
        title: "Frpc Desktop",
        body: "连接已断开，请前往日志查看原因"
      }).show();
      clearInterval(frpcStatusListener);
    }
  }, 3000);
};

/**
 *  重载frpc配置
 */
export const reloadFrpcProcess = () => {
  if (frpcProcess && !frpcProcess.killed) {
    getConfig((err1, config) => {
      if (!err1) {
        if (config) {
          generateConfig(config, configPath => {
            const command = `${runningCmd.commandPath} reload -c ${configPath}`;
            log.info(`重载配置：${command}`);
            exec(command, {
              cwd: app.getPath("userData"),
              shell: true
            });
          });
        }
      }
    });
  }
};

/**
 * 停止frpc子进程
 */
export const stopFrpcProcess = (callback?: () => void) => {
  if (frpcProcess) {
    treeKill(frpcProcess.pid, (error: Error) => {
      if (error) {
        log.error(`关闭frpc子进程失败 pid：${frpcProcess.pid} error：${error}`);
        callback();
      } else {
        log.info(`关闭frpc子进程成功`);
        frpcProcess = null;
        clearInterval(frpcStatusListener);
        callback();
      }
    });
  } else {
    callback();
  }
};

/**
 * 获取frpc子进程状态
 */
export const frpcProcessStatus = () => {
  if (!frpcProcess) {
    return false;
  }
  try {
    // 发送信号给进程，如果进程存在，会正常返回
    process.kill(frpcProcess.pid, 0);
    return true;
  } catch (error) {
    // 进程不存在，抛出异常
    return false;
  }
};

/**
 * 启动frpc流程
 * @param config
 */
export const startFrpWorkerProcess = async (config: FrpConfig) => {
  getFrpcVersionWorkerPath(config.currentVersion, (frpcVersionPath: string) => {
    if (frpcVersionPath) {
      generateConfig(config, configPath => {
        const platform = process.platform;
        if (platform === "win32") {
          startFrpcProcess(path.join(frpcVersionPath, "frpc.exe"), configPath);
        } else {
          startFrpcProcess(path.join(frpcVersionPath, "frpc"), configPath);
        }
      });
    }
  });
};

export const initFrpcApi = () => {
  ipcMain.handle("frpc.running", async (event, args) => {
    return frpcProcessStatus();
  });

  ipcMain.on("frpc.start", async (event, args) => {
    getConfig((err1, config) => {
      if (!err1) {
        if (!config) {
          event.reply(
            "Home.frpc.start.error.hook",
            "请先前往设置页面，修改配置后再启动"
          );
          return;
        }
        if (!config.currentVersion) {
          event.reply(
            "Home.frpc.start.error.hook",
            "请先前往设置页面，修改配置后再启动"
          );
          return;
        }
        startFrpWorkerProcess(config);
      }
    });
  });

  ipcMain.on("frpc.stop", () => {
    if (frpcProcess && !frpcProcess.killed) {
      stopFrpcProcess(() => {});
    }
  });
};
