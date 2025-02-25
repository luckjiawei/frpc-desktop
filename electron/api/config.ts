// import { app, dialog, ipcMain, shell } from "electron";
// import { clearConfig, getConfig, saveConfig } from "../storage/config";
// import { clearVersion, listVersion } from "../storage/version";
// import { genIniConfig, genTomlConfig, stopFrpcProcess } from "./frpc";
// import { clearProxy, insertProxy, listProxy } from "../storage/proxy";
// import path from "path";
// import fs from "fs";
// import { logDebug, logError, logInfo, LogModule, logWarn } from "../utils/log";
//
// const toml = require("@iarna/toml");
// const { v4: uuidv4 } = require("uuid");
//
// export const initConfigApi = win => {
//   ipcMain.on("config.saveConfig", async (event, args) => {
//     logInfo(LogModule.APP, "Attempting to save configuration.");
//     saveConfig(args, (err, numberOfUpdated, upsert) => {
//       if (!err) {
//         const start = args.systemSelfStart || false;
//         logDebug(LogModule.APP, "Startup status set to: " + start);
//         app.setLoginItemSettings({
//           openAtLogin: start, //win
//           openAsHidden: start //macOs
//         });
//         logInfo(LogModule.APP, "Configuration saved successfully.");
//       } else {
//         logError(LogModule.APP, `Error saving configuration: ${err}`);
//       }
//       event.reply("Config.saveConfig.hook", {
//         err: err,
//         numberOfUpdated: numberOfUpdated,
//         upsert: upsert
//       });
//     });
//   });
//
//   ipcMain.on("config.getConfig", async (event, args) => {
//     logInfo(LogModule.APP, "Requesting configuration.");
//     getConfig((err, doc) => {
//       if (err) {
//         logError(LogModule.APP, `Error retrieving configuration: ${err}`);
//       }
//       event.reply("Config.getConfig.hook", {
//         err: err,
//         data: doc
//       });
//     });
//   });
//
//   ipcMain.on("config.versions", event => {
//     logInfo(LogModule.APP, "Requesting version information.");
//     listVersion((err, doc) => {
//       if (err) {
//         logError(LogModule.APP, `Error retrieving version information: ${err}`);
//       }
//       event.reply("Config.versions.hook", {
//         err: err,
//         data: doc
//       });
//     });
//   });
//
//   ipcMain.on("config.hasConfig", event => {
//     logInfo(LogModule.APP, "Checking if configuration exists.");
//     getConfig((err, doc) => {
//       if (err) {
//         logError(LogModule.APP, `Error checking configuration: ${err}`);
//       }
//       event.reply("Config.getConfig.hook", {
//         err: err,
//         data: doc
//       });
//     });
//   });
//
//   ipcMain.on("config.exportConfig", async (event, args) => {
//     logInfo(LogModule.APP, "Attempting to export configuration.");
//     const result = await dialog.showOpenDialog({
//       properties: ["openDirectory"]
//     });
//     const outputDirectory = result.filePaths[0];
//     if (!outputDirectory) {
//       logWarn(LogModule.APP, "Export canceled by user.");
//       return;
//     }
//
//     logInfo(
//       LogModule.APP,
//       `Exporting configuration to directory ${outputDirectory} with type: ${args}`
//     );
//     getConfig((err1, config) => {
//       if (!err1 && config) {
//         listProxy((err2, proxys) => {
//           if (!err2) {
//             let configContent = "";
//             if (args === "ini") {
//               configContent = genIniConfig(config, proxys);
//             } else if (args === "toml") {
//               configContent = genTomlConfig(config, proxys);
//             }
//             const configPath = path.join(
//               outputDirectory,
//               `frpc-desktop.${args}`
//             );
//             fs.writeFile(
//               configPath, // 配置文件目录
//               configContent, // 配置文件内容
//               { flag: "w" },
//               err => {
//                 if (err) {
//                   logError(
//                     LogModule.APP,
//                     `Error writing configuration file: ${err}`
//                   );
//                   event.reply("config.exportConfig.hook", {
//                     data: "导出错误",
//                     err: err
//                   });
//                 } else {
//                   logInfo(
//                     LogModule.APP,
//                     "Configuration exported successfully."
//                   );
//                   event.reply("Config.exportConfig.hook", {
//                     data: {
//                       configPath: configPath
//                     }
//                   });
//                 }
//               }
//             );
//           } else {
//             logError(LogModule.APP, `Error listing proxies: ${err2}`);
//           }
//         });
//       } else {
//         logError(LogModule.APP, `Error retrieving configuration: ${err1}`);
//       }
//     });
//   });
//
//   const parseTomlConfig = (tomlPath: string) => {
//     logInfo(LogModule.APP, `Parsing TOML configuration from ${tomlPath}`);
//     const importConfigPath = tomlPath;
//     const tomlData = fs.readFileSync(importConfigPath, "utf-8");
//     logInfo(LogModule.APP, "Configuration content read successfully.");
//     const sourceConfig = toml.parse(tomlData);
//     // 解析config
//     const targetConfig: FrpConfig = {
//       currentVersion: null,
//       serverAddr: sourceConfig.serverAddr || "",
//       serverPort: sourceConfig.serverPort || "",
//       authMethod: sourceConfig?.user
//         ? "multiuser"
//         : sourceConfig?.auth?.method || "",
//       authToken: sourceConfig?.auth?.token || "",
//       transportHeartbeatInterval:
//         sourceConfig?.transport?.heartbeatInterval || 30,
//       transportHeartbeatTimeout:
//         sourceConfig?.transport?.heartbeatTimeout || 90,
//       tlsConfigEnable: sourceConfig?.transport?.tls?.enable || false,
//       tlsConfigCertFile: sourceConfig?.transport?.tls?.certFile || "",
//       tlsConfigKeyFile: sourceConfig?.transport?.tls?.keyFile || "",
//       tlsConfigServerName: sourceConfig?.transport?.tls?.serverName || "",
//       tlsConfigTrustedCaFile: sourceConfig?.transport?.tls?.trustedCaFile || "",
//       logLevel: sourceConfig?.log?.level || "info",
//       logMaxDays: sourceConfig?.log?.maxDays || 3,
//       proxyConfigProxyUrl: sourceConfig?.transport?.proxyURL || "",
//       proxyConfigEnable: Boolean(sourceConfig?.transport?.proxyURL) || false,
//       user: sourceConfig?.user || "",
//       metaToken: sourceConfig?.metadatas?.token || "",
//       systemSelfStart: false,
//       systemStartupConnect: false,
//       systemSilentStartup: false,
//       webEnable: true,
//       webPort: sourceConfig?.webServer?.port || 57400,
//       transportProtocol: sourceConfig?.transport?.protocol || "tcp",
//       transportDialServerTimeout:
//         sourceConfig?.transport?.dialServerTimeout || 10,
//       transportDialServerKeepalive:
//         sourceConfig?.transport?.dialServerKeepalive || 70,
//       transportPoolCount: sourceConfig?.transport?.poolCount || 0,
//       transportTcpMux: sourceConfig?.transport?.tcpMux || true,
//       transportTcpMuxKeepaliveInterval:
//         sourceConfig?.transport?.tcpMuxKeepaliveInterval || 7200
//     };
//     let frpcProxys = [];
//     // 解析proxy
//     if (sourceConfig?.proxies && sourceConfig.proxies.length > 0) {
//       const frpcProxys1 = sourceConfig.proxies.map(m => {
//         const rm: Proxy = {
//           _id: uuidv4(),
//           name: m?.name,
//           type: m?.type,
//           localIp: m?.localIP || "",
//           localPort: m?.localPort || null,
//           remotePort: m?.remotePort || null,
//           customDomains: m?.customDomains || [],
//           subdomain: m.subdomain || "",
//           basicAuth: m.basicAuth || false,
//           httpUser: m.httpUser || "",
//           httpPassword: m.httpPassword || "",
//           // 以下为stcp参数
//           stcpModel: "visited",
//           serverName: "",
//           secretKey: m?.secretKey || "",
//           bindAddr: "",
//           bindPort: null,
//           status: m?.status || true,
//           fallbackTo: m?.fallbackTo,
//           fallbackTimeoutMs: m?.fallbackTimeoutMs || 500,
//           keepTunnelOpen: m?.keepTunnelOpen || false,
//           https2http: m?.https2http || false,
//           https2httpCaFile: m?.https2httpCaFile || "",
//           https2httpKeyFile: m?.https2httpKeyFile || ""
//         };
//         return rm;
//       });
//       frpcProxys = [...frpcProxys, ...frpcProxys1];
//       logInfo(LogModule.APP, "Parsed proxies from configuration.");
//     }
//     // 解析stcp的访问者
//     if (sourceConfig?.visitors && sourceConfig.visitors.length > 0) {
//       const frpcProxys2 = sourceConfig.visitors.map(m => {
//         const rm: Proxy = {
//           _id: uuidv4(),
//           name: m?.name,
//           type: m?.type,
//           localIp: "",
//           localPort: null,
//           remotePort: null,
//           customDomains: [],
//           subdomain: m.subdomain || "",
//           basicAuth: m.basicAuth || false,
//           httpUser: m.httpUser || "",
//           httpPassword: m.httpPassword || "",
//           // 以下为stcp参数
//           stcpModel: "visitors",
//           serverName: m?.serverName,
//           secretKey: m?.secretKey || "",
//           bindAddr: m?.bindAddr,
//           bindPort: m?.bindPort,
//           status: m?.status || true,
//           fallbackTo: m?.fallbackTo,
//           fallbackTimeoutMs: m?.fallbackTimeoutMs || 500,
//           keepTunnelOpen: m?.keepTunnelOpen || false,
//           https2http: m?.https2http || false,
//           https2httpCaFile: m?.https2httpCaFile || "",
//           https2httpKeyFile: m?.https2httpKeyFile || ""
//         };
//         return rm;
//       });
//       frpcProxys = [...frpcProxys, ...frpcProxys2];
//       logInfo(LogModule.APP, "Parsed visitors from configuration.");
//     }
//     if (targetConfig) {
//       clearConfig(() => {
//         logInfo(LogModule.APP, "Clearing existing configuration.");
//         saveConfig(targetConfig);
//         logInfo(LogModule.APP, "New configuration saved.");
//       });
//     }
//     if (frpcProxys && frpcProxys.length > 0) {
//       clearProxy(() => {
//         frpcProxys.forEach(f => {
//           insertProxy(f, err => {
//             if (err) {
//               logError(LogModule.APP, `Error inserting proxy: ${err}`);
//             } else {
//               logInfo(LogModule.APP, `Inserted proxy: ${JSON.stringify(f)}`);
//             }
//           });
//         });
//       });
//     }
//   };
//
//   ipcMain.on("config.importConfig", async (event, args) => {
//     logInfo(LogModule.APP, "Attempting to import configuration.");
//     const result = await dialog.showOpenDialog(win, {
//       properties: ["openFile"],
//       filters: [
//         { name: "FrpcConfig Files", extensions: ["toml", "ini"] } // 允许选择的文件类型
//       ]
//     });
//     if (result.canceled) {
//       logWarn(LogModule.APP, "Import canceled by user.");
//       return;
//     } else {
//       const filePath = result.filePaths[0];
//       const fileExtension = path.extname(filePath); // 获取文件后缀名
//       logWarn(
//         LogModule.APP,
//         `Importing file ${filePath} with extension ${fileExtension}`
//       );
//       if (fileExtension === ".toml") {
//         parseTomlConfig(filePath);
//         event.reply("Config.importConfig.hook", {
//           success: true
//         });
//       } else {
//         logError(
//           LogModule.APP,
//           `Import failed, unsupported file format: ${fileExtension}`
//         );
//         event.reply("Config.importConfig.hook", {
//           success: false,
//           data: `导入失败，暂不支持 ${fileExtension} 格式文件`
//         });
//       }
//     }
//   });
//
//   ipcMain.on("config.clearAll", async (event, args) => {
//     logInfo(LogModule.APP, "Clearing all configurations.");
//     stopFrpcProcess(() => {
//       clearConfig();
//       clearProxy();
//       clearVersion();
//       event.reply("Config.clearAll.hook", {});
//       logInfo(LogModule.APP, "All configurations cleared.");
//     });
//   });
//
//   ipcMain.on("config.openDataFolder", async (event, args) => {
//     const userDataPath = app.getPath("userData");
//     logInfo(LogModule.APP, "Attempting to open data folder.");
//     shell.openPath(userDataPath).then(errorMessage => {
//       if (errorMessage) {
//         logError(LogModule.APP, `Failed to open data folder: ${errorMessage}`);
//         event.reply("Config.openDataFolder.hook", false);
//       } else {
//         logInfo(LogModule.APP, "Data folder opened successfully.");
//         event.reply("Config.openDataFolder.hook", true);
//       }
//     });
//   });
// };
