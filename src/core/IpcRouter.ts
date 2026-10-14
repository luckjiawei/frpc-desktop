export const ipcRouters: IpcRouters = {
  SERVER: {
    saveConfig: {
      path: "server/saveConfig",
      controller: "configController.saveConfig"
    },
    getServerConfig: {
      path: "server/getServerConfig",
      controller: "configController.getServerConfig"
    },
    resetAllConfig: {
      path: "server/resetAllConfig",
      controller: "configController.resetAllConfig"
    },
    exportConfig: {
      path: "server/exportConfig",
      controller: "configController.exportConfig"
    },
    importTomlConfig: {
      path: "server/importTomlConfig",
      controller: "configController.importTomlConfig"
    },
    getLanguage: {
      path: "server/getLanguage",
      controller: "configController.getLanguage"
    },
    saveLanguage: {
      path: "server/saveLanguage",
      controller: "configController.saveLanguage"
    },
    getTheme: {
      path: "server/getTheme",
      controller: "configController.getTheme"
    },
    saveTheme: {
      path: "server/saveTheme",
      controller: "configController.saveTheme"
    }
  },
  LOG: {
    getFrpLogContent: {
      path: "log/getFrpLogContent",
      controller: "logController.getFrpLogContent"
    },
    getAppLogContent: {
      path: "log/getAppLogContent",
      controller: "logController.getAppLogContent"
    },
    openFrpcLogFile: {
      path: "log/openFrpcLogFile",
      controller: "logController.openFrpcLogFile"
    },
    openAppLogFile: {
      path: "log/openAppLogFile",
      controller: "logController.openAppLogFile"
    }
  },
  VERSION: {
    getVersions: {
      path: "version/getVersions",
      controller: "versionController.getVersions"
    },
    downloadVersion: {
      path: "version/downloadVersion",
      controller: "versionController.downloadFrpVersion"
    },
    getDownloadedVersions: {
      path: "version/getDownloadedVersions",
      controller: "versionController.getDownloadedVersions"
    },
    deleteDownloadedVersion: {
      path: "version/deleteDownloadedVersion",
      controller: "versionController.deleteDownloadedVersion"
    },
    importLocalFrpcVersion: {
      path: "version/importLocalFrpcVersion",
      controller: "versionController.importLocalFrpcVersion"
    },
    detectFrpcPath: {
      path: "version/detectFrpcPath",
      controller: "versionController.detectFrpcPath"
    },
    validateFrpcPath: {
      path: "version/validateFrpcPath",
      controller: "versionController.validateFrpcPath"
    }
  },
  LAUNCH: {
    launch: {
      path: "launch/launch",
      controller: "launchController.launch"
    },
    terminate: {
      path: "launch/terminate",
      controller: "launchController.terminate"
    },
    getStatus: {
      path: "launch/getStatus",
      controller: "launchController.getStatus"
    },
    getStatuses: {
      path: "launch/getStatuses",
      controller: "launchController.getStatuses"
    },
    launchAll: {
      path: "launch/launchAll",
      controller: "launchController.launchAll"
    },
    terminateAll: {
      path: "launch/terminateAll",
      controller: "launchController.terminateAll"
    }
  },
  TUNNEL: {
    list: {
      path: "tunnel/list",
      controller: "tunnelController.list"
    },
    create: {
      path: "tunnel/create",
      controller: "tunnelController.create"
    },
    update: {
      path: "tunnel/update",
      controller: "tunnelController.update"
    },
    delete: {
      path: "tunnel/delete",
      controller: "tunnelController.delete"
    }
  },
  PROXY: {
    createProxy: {
      path: "proxy/createProxy",
      controller: "proxyController.createProxy"
    },
    modifyProxy: {
      path: "proxy/modifyProxy",
      controller: "proxyController.modifyProxy"
    },
    deleteProxy: {
      path: "proxy/deleteProxy",
      controller: "proxyController.deleteProxy"
    },
    getAllProxies: {
      path: "proxy/getAllProxies",
      controller: "proxyController.getAllProxies"
    },
    modifyProxyStatus: {
      path: "proxy/modifyProxyStatus",
      controller: "proxyController.modifyProxyStatus"
    },
    getLocalPorts: {
      path: "proxy/getLocalPorts",
      controller: "proxyController.getLocalPorts"
    }
  },
  SYSTEM: {
    getSystemConfig: {
      path: "system/getSystemConfig",
      controller: "systemController.getSystemConfig"
    },
    saveSystemConfig: {
      path: "system/saveSystemConfig",
      controller: "systemController.saveSystemConfig"
    },
    openUrl: {
      path: "system/openUrl",
      controller: "systemController.openUrl"
    },
    relaunchApp: {
      path: "system/relaunchApp",
      controller: "systemController.relaunchApp"
    },
    getGuideStatus: {
      path: "system/getGuideStatus",
      controller: "systemController.getGuideStatus"
    },
    completeGuide: {
      path: "system/completeGuide",
      controller: "systemController.completeGuide"
    },
    openAppData: {
      path: "system/openAppData",
      controller: "systemController.openAppData"
    },
    selectLocalFile: {
      path: "system/selectLocalFile",
      controller: "systemController.selectLocalFile"
    },
    getFrpcDesktopGithubLastRelease: {
      path: "system/getFrpcDesktopGithubLastRelease",
      controller: "systemController.getFrpcDesktopGithubLastRelease"
    }
  }
};

export const listeners: Listeners = {
  // watchFrpcLog: {
  //   listenerMethod: "logService.watchFrpcLog",
  //   channel: "log:watchFrpcLog"
  // },
  watchTunnelStatus: {
    listenerMethod: "runtimeManager.watchTunnelStatus",
    channel: "tunnel:status"
  },
  watchSystemUsage: {
    listenerMethod: "systemService.getSystemUsage",
    channel: "system:watchSystemUsage"
  }
};
