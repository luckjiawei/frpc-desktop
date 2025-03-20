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
      import: "Import"
    },
    message: {
      importSuccess: "Import successfully",
      deleteSuccess: "Delete successfully"
    },
    alert: {
      deleteConfirm: {
        title: "Prompt",
        message:
          'Are you sure you want to delete <span class="text-primary font-bold">{name}</span> ?',
        cancel: "Cancel",
        confirm: "Delete"
      },
      importFailed: {
        title: "Import failed",
        versionExists: "Version already exists",
        architectureNotMatch:
          "The selected frp architecture does not match the operating system",
        unrecognizedFile: "Unable to recognize the file"
      }
    },
    version: {
      downloadCount: "Download count:",
      publishTime: "Publish time:",
      downloaded: "Downloaded",
      delete: "Delete",
      download: "Download",
      noVersions: "No available versions"
    }
  },
  logger: {
    message: {
      openSuccess: "Open log successfully",
      refreshSuccess: "Refresh successfully"
    },
    content: {
      empty: "No log"
    }
  },
  about: {
    button: {
      doc: "Documentation",
      donate: "Donate",
      github: "Repository",
      issues: "Feedback"
    },
    description: {
      autoStart: "Auto Start",
      visualConfig: "Visual Configuration",
      freeAndOpen: "Free and Open Source"
    },
    version: {
      latest: "Latest Version"
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
        requireMessage: "Please select auth method",
        none: "None",
        token: "Token"
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
  proxy: {
    inner: "Inner",
    mappingAddress: "Mapping Address",
    visitors: "Visitors",
    visitorsProvider: "Visitors Provider",
    visitorsName: "Visitors Name",
    noProxy: "No proxy",

    form: {
      editDialog: {
        title: "Edit Proxy"
      },

      title: {
        basicConfig: "Basic Configuration",
        domainConfig: "Domain Configuration",
        proxyTransportConfig: "Proxy Transport Configuration",
        customConfig: "Custom Configuration",
        pluginConfig: "Plugin Configuration",
        otherConfig: "Other Proxy Configuration",
        editDialog: "Edit Proxy"
      },
      button: {
        localPort: "Local Port",
        generateName: "Generate"
      },
      formItem: {
        proxyType: {
          label: "Proxy Type",
          requireMessage: "Please select proxy type"
        },
        name: {
          label: "Proxy Name",
          requireMessage: "Please enter proxy name",
          placeholder: "Please enter proxy name"
        },
        localIP: {
          label: "Local IP",
          requireMessage: "Please enter local IP"
        },
        localPort: {
          label: "Local Port",
          requireMessage: "Please enter local port"
        },
        remotePort: {
          label: "Remote Port",
          requireMessage: "Please enter remote port"
        },
        subdomain: {
          label: "Subdomain",
          requireMessage: "Please enter subdomain"
        },
        customDomains: {
          label: "Custom Domains",
          requireMessage: "Please enter custom domains"
        },
        basicAuth: {
          label: "HTTP Basic Auth",
          requireMessage: "Please select whether to enable HTTP basic auth"
        },
        httpUser: {
          label: "Auth Username",
          requireMessage: "Please enter auth username"
        },
        httpPassword: {
          label: "Auth Password",
          requireMessage: "Please enter auth password"
        },
        https2httpCaFile: {
          label: "Certificate File",
          requireMessage: "Please select certificate file",
          placeholder: "Click to select certificate file"
        },
        bindPort: {
          label: "Bind Port",
          requireMessage: "Please enter bind port"
        },
        transportUseEncryption: {
          label: "Encryption",
          requireMessage: "Please select whether to enable encryption"
        },
        transportUseCompression: {
          label: "Compression",
          requireMessage: "Please select whether to enable compression"
        },
        bindAddr: {
          label: "Bind Address",
          requireMessage: "Please enter bind address"
        },
        secretKey: {
          label: "Secret Key",
          placeholder: "Secret key",
          requireMessage: "Please enter secret key"
        },
        https2httpKeyFile: {
          label: "Key File",
          requireMessage: "Please select key file",
          placeholder: "Click to select key file"
        },
        serverName: {
          label: "Provider Proxy Name",
          requireMessage: "Please enter provider proxy name",
          placeholder: "STCP provider proxy name"
        }
      }
    }
  },
  common: {
    yes: "Y",
    no: "N",
    edit: "Edit",
    delete: "Delete",
    more: "More",
    disable: "Disable",
    enable: "Enable",
    disabled: "Disabled",
    enabled: "Enabled"
  }
};
