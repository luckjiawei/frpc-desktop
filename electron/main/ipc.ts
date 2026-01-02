// export const ipcRouters: IpcRouters = {
//   SERVER: {
//     saveConfig: {
//       path: "server/saveConfig",
//       controller: "configController.saveConfig"
//     },
//     getServerConfig: {
//       path: "server/getServerConfig",
//       controller: "configController.getServerConfig"
//     },
//     resetAllConfig: {
//       path: "server/resetAllConfig",
//       controller: "configController.resetAllConfig"
//     },
//     exportConfig: {
//       path: "server/exportConfig",
//       controller: "configController.exportConfig"
//     },
//     importTomlConfig: {
//       path: "server/importTomlConfig",
//       controller: "configController.importTomlConfig"
//     },
//     getLanguage: {
//       path: "server/getLanguage",
//       controller: "configController.getLanguage"
//     },
//     saveLanguage: {
//       path: "server/saveLanguage",
//       controller: "configController.saveLanguage"
//     }
//   },
//   LOG: {
//     getFrpLogContent: {
//       path: "log/getFrpLogContent",
//       controller: "logController.getFrpLogContent"
//     },
//     getAppLogContent: {
//       path: "log/getAppLogContent",
//       controller: "logController.getAppLogContent"
//     },
//     openFrpcLogFile: {
//       path: "log/openFrpcLogFile",
//       controller: "logController.openFrpcLogFile"
//     },
//     openAppLogFile: {
//       path: "log/openAppLogFile",
//       controller: "logController.openAppLogFile"
//     }
//   },
//   VERSION: {
//     getVersions: {
//       path: "version/getVersions",
//       controller: "versionController.getVersions"
//     },
//     downloadVersion: {
//       path: "version/downloadVersion",
//       controller: "versionController.downloadFrpVersion"
//     },
//     getDownloadedVersions: {
//       path: "version/getDownloadedVersions",
//       controller: "versionController.getDownloadedVersions"
//     },
//     deleteDownloadedVersion: {
//       path: "version/deleteDownloadedVersion",
//       controller: "versionController.deleteDownloadedVersion"
//     },
//     importLocalFrpcVersion: {
//       path: "version/importLocalFrpcVersion",
//       controller: "versionController.importLocalFrpcVersion"
//     }
//   },
//   LAUNCH: {
//     launch: {
//       path: "launch/launch",
//       controller: "launchController.launch"
//     },
//     terminate: {
//       path: "launch/terminate",
//       controller: "launchController.terminate"
//     },
//     getStatus: {
//       path: "launch/getStatus",
//       controller: "launchController.getStatus"
//     }
//   },
//   PROXY: {
//     createProxy: {
//       path: "proxy/createProxy",
//       controller: "proxyController.createProxy"
//     },
//     modifyProxy: {
//       path: "proxy/modifyProxy",
//       controller: "proxyController.modifyProxy"
//     },
//     deleteProxy: {
//       path: "proxy/deleteProxy",
//       controller: "proxyController.deleteProxy"
//     },
//     getAllProxies: {
//       path: "proxy/getAllProxies",
//       controller: "proxyController.getAllProxies"
//     },
//     modifyProxyStatus: {
//       path: "proxy/modifyProxyStatus",
//       controller: "proxyController.modifyProxyStatus"
//     },
//     getLocalPorts: {
//       path: "proxy/getLocalPorts",
//       controller: "proxyController.getLocalPorts"
//     }
//   },
//   SYSTEM: {
//     openUrl: {
//       path: "system/openUrl",
//       controller: "systemController.openUrl"
//     },
//     relaunchApp: {
//       path: "system/relaunchApp",
//       controller: "systemController.relaunchApp"
//     },
//     openAppData: {
//       path: "system/openAppData",
//       controller: "systemController.openAppData"
//     },
//     selectLocalFile: {
//       path: "system/selectLocalFile",
//       controller: "systemController.selectLocalFile"
//     },
//     getFrpcDesktopGithubLastRelease: {
//       path: "system/getFrpcDesktopGithubLastRelease",
//       controller: "systemController.getFrpcDesktopGithubLastRelease"
//     }
//   }
// };

// export const listeners: Listeners = {
//   // watchFrpcLog: {
//   //   listenerMethod: "logService.watchFrpcLog",
//   //   channel: "log:watchFrpcLog"
//   // },
//   watchFrpcProcess: {
//     listenerMethod: "frpcProcessService.watchFrpcProcess",
//     channel: "frpcProcess:watchFrpcLog"
//   },
//   frpcProcessGuardian: {
//     listenerMethod: "frpcProcessService.frpcProcessGuardian",
//     channel: "frpcProcess:frpcProcessGuardian"
//   },
//   watchSystemUsage: {
//     listenerMethod: "systemService.getSystemUsage",
//     channel: "system:watchSystemUsage"
//   }
// };

// /**
//  * initializeRouters
//  * @private
//  */
// export function initializeRouters() {
//   Object.keys(ipcRouters).forEach(routerKey => {
//     const routerGroup = ipcRouters[routerKey];

//     Object.keys(routerGroup).forEach(method => {
//       const router = routerGroup[method];
//       ipcMain.on(router.path, (event, args) => {
//         const req: ControllerParam = {
//           // win: BeanFactory.getBean("win"),
//           channel: `${router.path}:hook`,
//           event: event,
//           args: args
//         };
//         const [beanName, method] = router.controller.split(".");
//         const bean = BeanFactory.getBean(beanName);
//         bean[method].call(bean, req);
//         log.debug(
//           `ipcRouter`,
//           `path: ${router.path} + req: (channel: ${
//             req.channel
//           }, args: ${JSON.stringify(req.args)}) => bean: ${beanName}.${method}`
//         );
//       });
//     });
//   });
//   log.scope("main").info("IPC Routers initialized.");
// }
