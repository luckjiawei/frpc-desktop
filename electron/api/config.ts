import { app, dialog, ipcMain } from "electron";
import { clearConfig, getConfig, saveConfig } from "../storage/config";
import { clearVersion, listVersion } from "../storage/version";
import {
  generateConfig,
  genIniConfig,
  genTomlConfig,
  stopFrpcProcess
} from "./frpc";
import { exec } from "child_process";
import { clearProxy, insertProxy, listProxy } from "../storage/proxy";
import path from "path";
import fs from "fs";

const log = require("electron-log");
const toml = require("@iarna/toml");
const { v4: uuidv4 } = require("uuid");

export const initConfigApi = win => {
  ipcMain.on("config.saveConfig", async (event, args) => {
    saveConfig(args, (err, numberOfUpdated, upsert) => {
      if (!err) {
        const start = args.systemSelfStart || false;
        log.info("开启自启状态", start);
        app.setLoginItemSettings({
          openAtLogin: start, //win
          openAsHidden: start //macOs
        });
      }
      event.reply("Config.saveConfig.hook", {
        err: err,
        numberOfUpdated: numberOfUpdated,
        upsert: upsert
      });
    });
  });

  ipcMain.on("config.getConfig", async (event, args) => {
    getConfig((err, doc) => {
      event.reply("Config.getConfig.hook", {
        err: err,
        data: doc
      });
    });
  });

  ipcMain.on("config.versions", event => {
    listVersion((err, doc) => {
      event.reply("Config.versions.hook", {
        err: err,
        data: doc
      });
    });
  });

  ipcMain.on("config.hasConfig", event => {
    getConfig((err, doc) => {
      event.reply("Config.getConfig.hook", {
        err: err,
        data: doc
      });
    });
  });

  ipcMain.on("config.exportConfig", async (event, args) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    const outputDirectory = result.filePaths[0];
    if (!outputDirectory) {
      // 取消了
      return;
    }
    log.info(`导出目录 ${outputDirectory} 类型：${args}`);
    getConfig((err1, config) => {
      if (!err1 && config) {
        listProxy((err2, proxys) => {
          if (!err2) {
            let configContent = "";
            if (args === "ini") {
              configContent = genIniConfig(config, proxys);
            } else if (args === "toml") {
              configContent = genTomlConfig(config, proxys);
            }
            const configPath = path.join(
              outputDirectory,
              `frpc-desktop.${args}`
            );
            fs.writeFile(
              configPath, // 配置文件目录
              configContent, // 配置文件内容
              { flag: "w" },
              err => {
                if (!err) {
                  // callback(filename);
                  event.reply("config.exportConfig.hook", {
                    data: "导出错误",
                    err: err
                  });
                }
              }
            );
            event.reply("Config.exportConfig.hook", {
              data: {
                configPath: configPath
              }
            });
          }
        });
      }
    });
  });

  const parseTomlConfig = (tomlPath: string) => {
    const importConfigPath = tomlPath;
    const tomlData = fs.readFileSync(importConfigPath, "utf-8");
    log.info(`读取到配置内容 ${tomlData}`);
    const sourceConfig = toml.parse(tomlData);
    // log.info(`解析结果 ${sourceConfig}`);
    // console.log(sourceConfig, "frpcConfig");
    // 解析config
    const targetConfig: FrpConfig = {
      currentVersion: null,
      serverAddr: sourceConfig.serverAddr || "",
      serverPort: sourceConfig.serverPort || "",
      authMethod: sourceConfig?.user
        ? "multiuser"
        : sourceConfig?.auth?.method || "",
      authToken: sourceConfig?.auth?.token || "",
      transportHeartbeatInterval:
        sourceConfig?.transport?.heartbeatInterval || 30,
      transportHeartbeatTimeout:
        sourceConfig?.transport?.heartbeatTimeout || 90,
      tlsConfigEnable: sourceConfig?.transport?.tls?.enable || false,
      tlsConfigCertFile: sourceConfig?.transport?.tls?.certFile || "",
      tlsConfigKeyFile: sourceConfig?.transport?.tls?.keyFile || "",
      tlsConfigServerName: sourceConfig?.transport?.tls?.serverName || "",
      tlsConfigTrustedCaFile: sourceConfig?.transport?.tls?.trustedCaFile || "",
      logLevel: sourceConfig?.log?.level || "info",
      logMaxDays: sourceConfig?.log?.maxDays || 3,
      proxyConfigProxyUrl: sourceConfig?.transport?.proxyURL || "",
      proxyConfigEnable: Boolean(sourceConfig?.transport?.proxyURL) || false,
      user: sourceConfig?.user || "",
      metaToken: sourceConfig?.metadatas?.token || "",
      systemSelfStart: false,
      systemStartupConnect: false,
      systemSilentStartup: false
    };
    let frpcProxys = [];
    // 解析proxy
    if (sourceConfig?.proxies && sourceConfig.proxies.length > 0) {
      const frpcProxys1 = sourceConfig.proxies.map(m => {
        const rm: Proxy = {
          _id: uuidv4(),
          name: m?.name,
          type: m?.type,
          localIp: m?.localIP || "",
          localPort: m?.localPort || null,
          remotePort: m?.remotePort || null,
          customDomains: m?.customDomains || [],
          subdomain: m.subdomain || "",
          basicAuth: m.basicAuth || false,
          httpUser: m.httpUser || "",
          httpPassword: m.httpPassword || "",
          // 以下为stcp参数
          stcpModel: "visited",
          serverName: "",
          secretKey: m?.secretKey || "",
          bindAddr: "",
          bindPort: null,
          status: m?.status || true,
          fallbackTo: m?.fallbackTo,
          fallbackTimeoutMs: m?.fallbackTimeoutMs || 500
        };
        return rm;
      });
      frpcProxys = [...frpcProxys, ...frpcProxys1];
    }
    // 解析stcp的访问者
    if (sourceConfig?.visitors && sourceConfig.visitors.length > 0) {
      const frpcProxys2 = sourceConfig.visitors.map(m => {
        const rm: Proxy = {
          _id: uuidv4(),
          name: m?.name,
          type: m?.type,
          localIp: "",
          localPort: null,
          remotePort: null,
          customDomains: [],
          subdomain: m.subdomain || "",
          basicAuth: m.basicAuth || false,
          httpUser: m.httpUser || "",
          httpPassword: m.httpPassword || "",
          // 以下为stcp参数
          stcpModel: "visitors",
          serverName: m?.serverName,
          secretKey: m?.secretKey || "",
          bindAddr: m?.bindAddr,
          bindPort: m?.bindPort,
          status: m?.status || true,
          fallbackTo: m?.fallbackTo,
          fallbackTimeoutMs: m?.fallbackTimeoutMs || 500
        };
        return rm;
      });
      frpcProxys = [...frpcProxys, ...frpcProxys2];
    }
    if (targetConfig) {
      clearConfig(() => {
        saveConfig(targetConfig);
      });
    }
    if (frpcProxys && frpcProxys.length > 0) {
      clearProxy(() => {
        frpcProxys.forEach(f => {
          insertProxy(f, err => {
            console.log("插入", f, err);
          });
        });
      });
    }
  };

  ipcMain.on("config.importConfig", async (event, args) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [
        { name: "FrpcConfig Files", extensions: ["toml", "ini"] } // 允许选择的文件类型
      ]
    });
    if (result.canceled) {
      return;
    } else {
      const filePath = result.filePaths[0];
      const fileExtension = path.extname(filePath); // 获取文件后缀名
      log.info(`导入文件 ${filePath} ${fileExtension}`);
      if (fileExtension === ".toml") {
        parseTomlConfig(filePath);
        event.reply("Config.importConfig.hook", {
          success: true
        });
      } else {
        event.reply("Config.importConfig.hook", {
          success: false,
          data: `导入失败，暂不支持 ${fileExtension} 格式文件`
        });
      }
    }
  });

  ipcMain.on("config.clearAll", async (event, args) => {
    stopFrpcProcess(() => {
      clearConfig();
      clearProxy();
      clearVersion();
      event.reply("Config.clearAll.hook", {});
    });
  });
};
