import { app, ipcMain, Notification } from "electron";
import { getConfig } from "../storage/config";
import { listProxy } from "../storage/proxy";
import { getVersionById } from "../storage/version";
import treeKill from "tree-kill";
import { logInfo, logError, LogModule, logDebug, logWarn } from "../utils/log";

const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");

export let frpcProcess = null;
const runningCmd = {
  commandPath: null,
  configPath: null
};
let frpcStatusListener = null;

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
    config.tlsConfigKeyFile = config.tlsConfigKeyFile.replace(/\\/g, "\\\\");
    config.tlsConfigCertFile = config.tlsConfigCertFile.replace(/\\/g, "\\\\");
    config.tlsConfigTrustedCaFile = config.tlsConfigTrustedCaFile.replace(
      /\\/g,
      "\\\\"
    );
    let toml = `${
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
${rangePort ? "" : `name = "${m.name}"`}
type = "${m.type}"\n`;

    switch (m.type) {
      case "tcp":
      case "udp":
        if (rangePort) {
          toml += `name = "${m.name}-{{ $v.First }}"
localPort = {{ $v.First }}
remotePort = {{ $v.Second }}\n`;
        } else {
          toml += `localIP = "${m.localIp}"
localPort = ${m.localPort}
remotePort = ${m.remotePort}\n`;
        }
        break;
      case "http":
      case "https":
        const customDomains = m.customDomains.filter(f1 => f1 !== "");
        if (customDomains && customDomains.length > 0) {
          toml += `customDomains=[${m.customDomains.map(m => `"${m}"`)}]\n`;
        }
        if (m.subdomain) {
          toml += `subdomain="${m.subdomain}"\n`;
        }
        if (m.basicAuth) {
          toml += `httpUser = "${m.httpUser}"
httpPassword = "${m.httpPassword}"\n`;
        }
        if (m.https2http) {
          toml += `[proxies.plugin]
type = "https2http"
localAddr =  "${m.localIp}:${m.localPort}"

crtPath =  "${m.https2httpCaFile}"
keyPath = "${m.https2httpKeyFile}"\n`;
        } else {
          toml += `localIP = "${m.localIp}"
localPort = ${m.localPort}\n`;
        }

        break;
      case "xtcp":
        if (m.stcpModel === "visitors") {
          toml += `keepTunnelOpen = ${m.keepTunnelOpen}\n`;
        }
      case "stcp":
      case "sudp":
        if (m.stcpModel === "visitors") {
          // 访问者
          toml += `serverName = "${m.serverName}"
bindAddr = "${m.bindAddr}"
bindPort = ${m.bindPort}\n`;
          if (m.fallbackTo) {
            toml += `fallbackTo = "${m.fallbackTo}"
fallbackTimeoutMs = ${m.fallbackTimeoutMs || 500}\n`;
          }
        } else if (m.stcpModel === "visited") {
          // 被访问者
          toml += `localIP = "${m.localIp}"
localPort = ${m.localPort}\n`;
        }

        toml += `secretKey="${m.secretKey}"\n`;
        break;
      default:
        break;
    }

    if (rangePort) {
      toml += `{{- end }}\n`;
    }
    return toml;
  });
  const toml = `serverAddr = "${config.serverAddr}"
serverPort = ${config.serverPort}
${
  config.authMethod === "token"
    ? `auth.method = "token"
auth.token = "${config.authToken}"`
    : ""
}
${
  config.authMethod === "multiuser"
    ? `user = "${config.user}"
metadatas.token = "${config.metaToken}"`
    : ""
}
log.to = "frpc.log"
log.level = "${config.logLevel}"
log.maxDays = ${config.logMaxDays}
webServer.addr = "127.0.0.1"
webServer.port = ${config.webPort}
${
  config.transportProtocol
    ? `transport.protocol = "${config.transportProtocol}"`
    : ""
}
${
  config.transportPoolCount
    ? `transport.poolCount = ${config.transportPoolCount}`
    : ""
}
${
  config.transportDialServerTimeout
    ? `transport.dialServerTimeout = ${config.transportDialServerTimeout}`
    : ""
}
${
  config.transportDialServerKeepalive
    ? `transport.dialServerKeepalive = ${config.transportDialServerKeepalive}`
    : ""
}
${
  config.transportHeartbeatInterval
    ? `transport.heartbeatInterval = ${config.transportHeartbeatInterval}`
    : ""
}
${
  config.transportHeartbeatTimeout
    ? `transport.heartbeatTimeout = ${config.transportHeartbeatTimeout}`
    : ""
}
${config.transportTcpMux ? `transport.tcpMux = ${config.transportTcpMux}` : ""}
${
  config.transportTcpMux && config.transportTcpMuxKeepaliveInterval
    ? `transport.tcpMuxKeepaliveInterval = ${config.transportTcpMuxKeepaliveInterval}`
    : ""
}
transport.tls.enable = ${config.tlsConfigEnable}
${
  config.tlsConfigEnable && config.tlsConfigCertFile
    ? `transport.tls.certFile = "${config.tlsConfigCertFile}"`
    : ""
}
${
  config.tlsConfigEnable && config.tlsConfigKeyFile
    ? `transport.tls.keyFile = "${config.tlsConfigKeyFile}"`
    : ""
}
  ${
    config.tlsConfigEnable && config.tlsConfigTrustedCaFile
      ? `transport.tls.trustedCaFile = "${config.tlsConfigTrustedCaFile}"`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigServerName
      ? `transport.tls.serverName = "${config.tlsConfigServerName}"`
      : ""
  }
${
  config.proxyConfigEnable
    ? `transport.proxyURL = "${config.proxyConfigProxyUrl}"`
    : ""
}
${proxyToml.join("")}`;
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
    let ini = `[${rangePort ? "range:" : ""}${m.name}]
type = "${m.type}"
`;
    switch (m.type) {
      case "tcp":
      case "udp":
        ini += `
local_ip = "${m.localIp}"
local_port = ${m.localPort}
remote_port = ${m.remotePort}\n`;
        break;
      case "http":
        ini += `
        local_ip = "${m.localIp}"
        local_port = ${m.localPort}
        custom_domains=[${m.customDomains.map(m => `${m}`)}]
        subdomain="${m.subdomain}"\n`;
        if (m.basicAuth) {
          ini += `
        httpUser = "${m.httpUser}"
        httpPassword = "${m.httpPassword}"\n`;
        }
        break;
      case "https":
        ini += `
custom_domains=[${m.customDomains.map(m => `${m}`)}]
subdomain="${m.subdomain}"\n`;
        if (m.basicAuth) {
          ini += `
httpUser = "${m.httpUser}"
httpPassword = "${m.httpPassword}"\n`;
        }
        if (m.https2http) {
          ini += `
plugin = https2http
plugin_local_addr = ${m.localIp}:${m.localPort}
plugin_crt_path = ${m.https2httpCaFile}
plugin_key_path = ${m.https2httpKeyFile}\n`;
        } else {
          ini += `
local_ip = "${m.localIp}"
local_port = ${m.localPort}\n`;
        }
        break;
      case "xtcp":
        if (m.stcpModel === "visitors") {
          ini += `keep_tunnel_open = ${m.keepTunnelOpen}\n`;
        }
      case "stcp":
      case "sudp":
        if (m.stcpModel === "visitors") {
          // 访问者
          ini += `
role = visitor
server_name = "${m.serverName}"
bind_addr = "${m.bindAddr}"
bind_port = ${m.bindPort}\n`;
          if (m.fallbackTo) {
            ini += `
fallback_to = ${m.fallbackTo}
fallback_timeout_ms = ${m.fallbackTimeoutMs || 500}\n`;
          }
        } else if (m.stcpModel === "visited") {
          // 被访问者
          ini += `
local_ip = "${m.localIp}"
local_port = ${m.localPort}\n`;
        }
        ini += `
sk="${m.secretKey}"\n`;
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
token = ${config.authToken}\n`
    : ""
}
${
  config.authMethod === "multiuser"
    ? `
user = ${config.user}
meta_token = ${config.metaToken}\n`
    : ""
}

${config.transportProtocol ? `protocol = ${config.transportProtocol}` : ""}
${config.transportPoolCount ? `pool_count = ${config.transportPoolCount}` : ""}
${
  config.transportDialServerTimeout
    ? `dial_server_timeout = ${config.transportDialServerTimeout}`
    : ""
}
${
  config.transportDialServerKeepalive
    ? `dial_server_keepalive = ${config.transportDialServerKeepalive}`
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
${config.transportTcpMux ? `transport.tcp_mux = ${config.transportTcpMux}` : ""}
${
  config.transportTcpMux && config.transportTcpMuxKeepaliveInterval
    ? `tcp_mux_keepalive_interval = ${config.transportTcpMuxKeepaliveInterval}`
    : ""
}
${
  config.tlsConfigEnable && config.tlsConfigCertFile
    ? `
tls_cert_file = ${config.tlsConfigCertFile}\n`
    : ""
}
  ${
    config.tlsConfigEnable && config.tlsConfigKeyFile
      ? `
tls_key_file = ${config.tlsConfigKeyFile}\n`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigTrustedCaFile
      ? `
tls_trusted_ca_file = ${config.tlsConfigTrustedCaFile}\n`
      : ""
  }
  ${
    config.tlsConfigEnable && config.tlsConfigServerName
      ? `
tls_server_name = ${config.tlsConfigServerName}\n`
      : ""
  }

  ${
    config.proxyConfigEnable
      ? `
  http_proxy = "${config.proxyConfigProxyUrl}"\n`
      : ""
  }

log_file = "frpc.log"
log_level = ${config.logLevel}
log_max_days = ${config.logMaxDays}
admin_addr = 127.0.0.1
admin_port = ${config.webPort}
tls_enable = ${config.tlsConfigEnable}


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
    if (err3) {
      logError(LogModule.FRP_CLIENT, `Failed to list proxies: ${err3.message}`);
      return;
    }

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
      logInfo(
        LogModule.FRP_CLIENT,
        `Using INI format for configuration: ${filename}`
      );
    } else {
      filename = "frp.toml";
      configContent = genTomlConfig(config, filtered);
      logInfo(
        LogModule.FRP_CLIENT,
        `Using TOML format for configuration: ${filename}`
      );
    }

    const configPath = path.join(app.getPath("userData"), filename);
    logInfo(
      LogModule.FRP_CLIENT,
      `Writing configuration to file: ${configPath}`
    );

    fs.writeFile(
      configPath, // 配置文件目录
      configContent, // 配置文件内容
      { flag: "w" },
      err => {
        if (err) {
          logError(
            LogModule.FRP_CLIENT,
            `Failed to write configuration file: ${err.message}`
          );
        } else {
          logInfo(
            LogModule.FRP_CLIENT,
            `Configuration file written successfully: ${filename}`
          );
          callback(filename);
        }
      }
    );
  });
};

/**
 * 启动frpc子进程
 * @param cwd
 * @param commandPath
 * @param configPath
 */
const startFrpcProcess = (commandPath: string, configPath: string) => {
  logInfo(
    LogModule.FRP_CLIENT,
    `Starting frpc process. Directory: ${app.getPath(
      "userData"
    )}, Command: ${commandPath}`
  );

  const command = `${commandPath} -c ${configPath}`;
  frpcProcess = spawn(command, {
    cwd: app.getPath("userData"),
    shell: true
  });
  runningCmd.commandPath = commandPath;
  runningCmd.configPath = configPath;

  frpcProcess.stdout.on("data", data => {
    logDebug(LogModule.FRP_CLIENT, `Frpc process output: ${data}`);
  });

  frpcProcess.stdout.on("error", data => {
    logError(LogModule.FRP_CLIENT, `Frpc process error: ${data}`);
    stopFrpcProcess(() => {});
  });

  frpcStatusListener = setInterval(() => {
    const status = frpcProcessStatus();
    logDebug(
      LogModule.FRP_CLIENT,
      `Monitoring frpc process status: ${status}, Listener ID: ${frpcStatusListener}`
    );
    if (!status) {
      new Notification({
        title: "Frpc Desktop",
        body: "Connection lost, please check the logs for details."
      }).show();
      logError(
        LogModule.FRP_CLIENT,
        "Frpc process status check failed. Connection lost."
      );
      clearInterval(frpcStatusListener);
    }
  }, 3000);
};

/**
 *  重载frpc配置
 */
export const reloadFrpcProcess = () => {
  if (frpcProcess && !frpcProcess.killed) {
    logDebug(
      LogModule.FRP_CLIENT,
      "Attempting to reload frpc process configuration."
    );
    getConfig((err1, config) => {
      if (!err1) {
        if (config) {
          generateConfig(config, configPath => {
            const command = `${runningCmd.commandPath} reload -c ${configPath}`;
            logInfo(
              LogModule.FRP_CLIENT,
              `Reloading configuration: ${command}`
            );
            exec(
              command,
              {
                cwd: app.getPath("userData"),
                shell: true
              },
              (error, stdout, stderr) => {
                if (error) {
                  logError(
                    LogModule.FRP_CLIENT,
                    `Error reloading configuration: ${error.message}`
                  );
                  return;
                }
                logDebug(
                  LogModule.FRP_CLIENT,
                  `Configuration reload output: ${stdout}`
                );
                if (stderr) {
                  logWarn(
                    LogModule.FRP_CLIENT,
                    `Configuration reload warnings: ${stderr}`
                  );
                }
              }
            );
          });
        } else {
          logWarn(LogModule.FRP_CLIENT, "No configuration found to reload.");
        }
      } else {
        logError(LogModule.FRP_CLIENT, `Error getting configuration: ${err1}`);
      }
    });
  } else {
    logDebug(
      LogModule.FRP_CLIENT,
      "frpc process is not running or has been killed."
    );
  }
};

/**
 * 停止frpc子进程
 */
export const stopFrpcProcess = (callback?: () => void) => {
  if (frpcProcess) {
    treeKill(frpcProcess.pid, (error: Error) => {
      if (error) {
        logError(
          LogModule.FRP_CLIENT,
          `Failed to stop frpc process with pid: ${frpcProcess.pid}. Error: ${error.message}`
        );
        callback();
      } else {
        logInfo(
          LogModule.FRP_CLIENT,
          `Successfully stopped frpc process with pid: ${frpcProcess.pid}.`
        );
        frpcProcess = null;
        clearInterval(frpcStatusListener);
        callback();
      }
    });
  } else {
    logWarn(
      LogModule.FRP_CLIENT,
      "Attempted to stop frpc process, but no process is running."
    );
    logWarn(LogModule.FRP_CLIENT, "No frpc process to stop.");
    callback();
  }
};

/**
 * 获取frpc子进程状态
 */
export const frpcProcessStatus = () => {
  if (!frpcProcess) {
    logDebug(LogModule.FRP_CLIENT, "frpc process is not running.");
    return false;
  }
  try {
    // 发送信号给进程，如果进程存在，会正常返回
    process.kill(frpcProcess.pid, 0);
    logDebug(
      LogModule.FRP_CLIENT,
      `frpc process is running with pid: ${frpcProcess.pid}`
    );
    return true;
  } catch (error) {
    // 进程不存在，抛出异常
    logError(
      LogModule.FRP_CLIENT,
      `frpc process not found. Error: ${error.message}`
    );
    return false;
  }
};

/**
 * 启动frpc流程
 * @param config
 */
export const startFrpWorkerProcess = async (config: FrpConfig) => {
  logInfo(LogModule.FRP_CLIENT, "Starting frpc worker process...");
  getFrpcVersionWorkerPath(config.currentVersion, (frpcVersionPath: string) => {
    if (frpcVersionPath) {
      logInfo(
        LogModule.FRP_CLIENT,
        `Found frpc version path: ${frpcVersionPath}`
      );
      generateConfig(config, configPath => {
        const platform = process.platform;
        if (platform === "win32") {
          logInfo(LogModule.FRP_CLIENT, "Starting frpc on Windows.");
          startFrpcProcess(path.join(frpcVersionPath, "frpc.exe"), configPath);
        } else {
          logInfo(
            LogModule.FRP_CLIENT,
            "Starting frpc on non-Windows platform."
          );
          startFrpcProcess(path.join(frpcVersionPath, "frpc"), configPath);
        }
      });
    } else {
      logError(LogModule.FRP_CLIENT, "frpc version path not found.");
    }
  });
};

export const initFrpcApi = () => {
  ipcMain.handle("frpc.running", async (event, args) => {
    logDebug(LogModule.FRP_CLIENT, "Checking if frpc process is running...");
    return frpcProcessStatus();
  });

  ipcMain.on("frpc.start", async (event, args) => {
    logInfo(LogModule.FRP_CLIENT, "Received request to start frpc process.");
    getConfig((err1, config) => {
      if (!err1) {
        if (!config) {
          logWarn(
            LogModule.FRP_CLIENT,
            "Configuration not found. Prompting user to set configuration."
          );
          event.reply(
            "Home.frpc.start.error.hook",
            "请先前往设置页面，修改配置后再启动"
          );
          return;
        }
        if (!config.currentVersion) {
          logWarn(
            LogModule.FRP_CLIENT,
            "Current version not set in configuration. Prompting user."
          );
          event.reply(
            "Home.frpc.start.error.hook",
            "请先前往设置页面，修改配置后再启动"
          );
          return;
        }
        startFrpWorkerProcess(config);
      } else {
        logError(LogModule.FRP_CLIENT, `Error getting configuration: ${err1}`);
      }
    });
  });

  ipcMain.on("frpc.stop", () => {
    logInfo(LogModule.FRP_CLIENT, "Received request to stop frpc process.");
    if (frpcProcess && !frpcProcess.killed) {
      stopFrpcProcess(() => {});
    } else {
      logWarn(LogModule.FRP_CLIENT, "No frpc process to stop.");
    }
  });
};
