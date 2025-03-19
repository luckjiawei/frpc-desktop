export default {
  app: {
    title: "Frpc Desktop",
    description: "开机自启 / 可视化配置 / 免费开源，提供便捷的使用体验。"
  },
  router: {
    home: {
      title: "Home"
    },
    proxy: {
      title: "Proxy"
    },
    download: {
      title: "Download"
    },
    config: {
      title: "Config"
    },
    logger: {
      title: "Logger"
    },
    about: {
      title: "About"
    }
  },
  home: {
    uptime: {
      days: "{days} days",
      hours: "{hours} hours",
      minutes: "{minutes} minutes",
      seconds: "{seconds} seconds"
    },
    status: {
      running: "Running",
      disconnected: "Disconnected",
      runningTime: "Running Time",
      frpcStatus: "Frpc {status}"
    },
    button: {
      start: "Start",
      stop: "Stop",
      viewLog: "View Log"
    },
    alert: {
      configRequired: {
        title: "提示",
        message: "请先前往设置页面，修改配置后再启动",
        confirm: "去设置"
      }
    }
  },
  comingSoon: {
    description: "敬请期待"
  },
  download: {
    button: {
      import: "导入"
    },
    message: {
      importSuccess: "导入成功",
      deleteSuccess: "删除成功"
    },
    alert: {
      deleteConfirm: {
        title: "提示",
        message:
          '确认要删除 <span class="text-primary font-bold">{name}</span> 吗？',
        cancel: "取消",
        confirm: "删除"
      },
      importFailed: {
        title: "导入失败",
        versionExists: "版本已存在",
        architectureNotMatch: "所选 frp 架构与操作系统不符",
        unrecognizedFile: "无法识别文件"
      }
    },
    version: {
      downloadCount: "下载数：",
      publishTime: "发布时间：",
      downloaded: "已下载",
      delete: "删 除",
      download: "下载",
      noVersions: "暂无可用版本"
    }
  },
  logger: {
    message: {
      openSuccess: "打开日志成功",
      refreshSuccess: "刷新成功"
    },
    content: {
      empty: "暂无日志"
    }
  },
  about: {
    button: {
      doc: "使用教程",
      donate: "捐赠名单",
      github: "仓库地址",
      issues: "反馈问题"
    },
    description: {
      autoStart: "开机自启",
      visualConfig: "可视化配置",
      freeAndOpen: "免费开源"
    },
    version: {
      latest: "最新版本"
    }
  },
  config: {
    form: {
      frpcVerson: {
        label: "Frp Version",
        requireMessage: "Please select Frp version"
      },
      serverAddr: {
        label: "Server Address",
        requireMessage: "Please enter server address",
        patternMessage: "Please enter the correct server address"
      },
      serverPort: {
        label: "Server Port",
        requireMessage: "Please enter server port"
      },
      user: {
        label: "User",
        requireMessage: "Please enter user"
      },
      multiuser: {
        label: "Multi-user",
        requireMessage: "Please select whether to enable multi-user"
      },
      metadatasToken: {
        label: "User Token",
        requireMessage: "Please enter user token"
      },
      authMethod: {
        label: "Auth Method",
        requireMessage: "Please select auth method"
      },
      authToken: {
        label: "Token",
        requireMessage: "Please enter token"
      },
      logLevel: {
        label: "Log Level",
        requireMessage: "Please select log level"
      },
      logMaxDays: {
        label: "Log Max Days",
        requireMessage: "Please enter log max days"
      },
      tlsEnable: {
        label: "TLS",
        requireMessage: "Please select TLS"
      },
      transportProxyURL: {
        label: "Proxy URL",
        requireMessage: "Please enter proxy URL",
        patternMessage: "Please enter the correct proxy URL"
      },
      systemLaunchAtStartup: {
        label: "Auto Start",
        requireMessage: "Please select whether to auto start"
      },
      systemSilentStartup: {
        label: "Silent Startup",
        requireMessage: "Please select whether to enable silent startup"
      },
      systemAutoConnectOnStartup: {
        label: "Auto Connect",
        requireMessage: "Please select whether to enable auto connect"
      },
      transportHeartbeatInterval: {
        label: "Heartbeat Interval",
        requireMessage: "Please enter heartbeat interval"
      },
      transportHeartbeatTimeout: {
        label: "Heartbeat Timeout",
        requireMessage: "Please enter heartbeat timeout"
      },
      webServerPort: {
        label: "Web Port",
        requireMessage: "Please enter web port"
      },
      transportProtocol: {
        label: "Transport Protocol",
        requireMessage: "Please enter transport protocol"
      },
      transportDialServerTimeout: {
        label: "Dial Server Timeout",
        requireMessage: "Please enter dial server timeout"
      },
      transportDialServerKeepalive: {
        label: "Dial Server Keepalive",
        requireMessage: "Please enter dial server keepalive"
      },
      transportPoolCount: {
        label: "Pool Count",
        requireMessage: "Please enter pool count"
      },
      transportTcpMux: {
        label: "TCP Mux",
        requireMessage: "Please enter TCP mux"
      },
      transportTcpMuxKeepaliveInterval: {
        label: "TCP Mux Keepalive Interval",
        requireMessage: "Please enter TCP mux keepalive interval"
      },
      tlsCertFile: {
        label: "TLS Cert File",
        requireMessage: "Please select TLS cert file"
      },
      tlsKeyFile: {
        label: "TLS Key File",
        requireMessage: "Please select TLS key file"
      },
      caCertFile: {
        label: "CA Cert File",
        requireMessage: "Please select CA cert file"
      },
      tlsServerName: {
        label: "TLS Server Name",
        requireMessage: "Please enter TLS server name"
      },
      systemLanguage: {
        label: "System Language",
        requireMessage: "Please select system language"
      }
    },
    title: {
      versionSelection: "Version Selection",
      webInterface: "Web Interface",
      transportConfiguration: "Transport Configuration",
      logConfiguration: "Log Configuration",
      systemConfiguration: "System Configuration",
      serverConfiguration: "Server Configuration"
    },
    button: {
      manualRefresh: "Manual Refresh",
      goToDownload: "Click here to download",
      clear: "Clear",
      import: "Import"
    },
    alert: {
      resetConfig: {
        title: "Prompt",
        message: "Are you sure you want to reset the configuration?",
        confirm: "Confirm",
        cancel: "Cancel"
      },
      resetConfigSuccess: {
        title: "Prompt",
        message: "Reset successfully, please restart the software",
        confirm: "Restart Now"
      },
      importTomlConfigSuccess: {
        title: "Prompt",
        message:
          "🎉 Congratulations, import successfully, please restart the software",
        confirm: "Restart Now"
      },
      multiuserAlert: {
        title: "Prompt",
        message:
          "The multi-user plugin requires Frp version >= <span class='font-black text-[#5A3DAA]'>v0.31.0</span>. Please select the correct version.",
        confirm: "Got it"
      },
      exportConfigSuccess: {
        title: "Prompt",
        message: "Configuration path: {path}"
      }
    },
    message: {
      invalidLink: "The link is incorrect, please enter the correct link",
      openAppDataSuccess: "Open data directory successfully",
      saveSuccess: "Save successfully"
    },
    popover: {
      frpParameter: "Frp Parameter"
    },
    dialog: {
      importLink: {
        title: "Import Link"
      },
      copyLink: {
        title: "Copy Link",
        message: "Copy successfully",
        warning: {
          message:
            "The content generated contains server keys and other information. Please keep it safe and the link is only available in Frpc-Desktop."
        }
      }
    }
  },
  common: {
    yes: "Y",
    no: "N"
  }
};
