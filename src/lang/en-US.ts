export default {
  app: {
    title: "Frpc Desktop",
    description: "开机自启 / 可视化配置 / 免费开源，提供便捷的使用体验。"
  },
  router: {
    home: {
      title: "Launch"
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
        title: "Prompt",
        message:
          "Please go to the settings page and modify the configuration before starting",
        confirm: "Go to Settings"
      },
      versionNotFound: {
        title: "Prompt",
        message:
          "Please go to the settings page and select the version before starting",
        confirm: "Go to Settings"
      },
      webServerPortInUse: {
        title: "Prompt",
        message:
          "The web server port is already in use, please go to the settings page and change the port",
        confirm: "Go to Settings"
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
      deleteSuccess: "Delete successfully",
      copyDownloadLinkSuccess: "Copy download link successfully"
    },
    alert: {
      deleteConfirm: {
        title: "Prompt",
        message:
          'Are you sure you want to delete <span class="font-bold text-primary">{name}</span> ?',
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
      downloadLink: "Download Link",
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
    },
    tab: {
      appLog: "App Log",
      frpcLog: "Frpc Log"
    },
    search: {
      placeholder: "Search logs..."
    },
    loading: {
      text: "Loading..."
    },
    autoRefresh: "Auto Refresh",
    autoRefreshTime: "{time}s after auto refresh"
  },
  about: {
    button: {
      doc: "Documentation",
      donate: "Donate",
      github: "Github",
      issues: "Feedback"
    },
    features: {
      autoStart: "Auto Start",
      visualConfig: "Visual Configuration",
      freeAndOpen: "Free and Open Source"
    },
    description:
      "FRP cross-platform desktop client, visual configuration, easy to implement intranet penetration!",
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
        patternMessage: "Please enter the correct server address",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>serverAddr</span> Frps service address supports <span class='font-black text-[#5A3DAA]'>domain name</span>、<span class='font-black text-[#5A3DAA]'>IP</span>"
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
        requireMessage: "Please select whether to auto start",
        tips: "Auto start the software when the system starts"
      },
      systemSilentStartup: {
        label: "Silent Startup",
        requireMessage: "Please select whether to enable silent startup",
        tips: "Silent startup will not show any UI when the system starts"
      },
      systemAutoConnectOnStartup: {
        label: "Auto Connect",
        requireMessage: "Please select whether to enable auto connect",
        tips: "Auto connect to the server when the system starts"
      },
      transportHeartbeatInterval: {
        label: "Heartbeat Interval",
        requireMessage: "Please enter heartbeat interval",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.heartbeatInterval</span> How often to send heartbeat packets to server. Unit: <span class='font-black text-[#5A3DAA]'>seconds</span>"
      },
      transportHeartbeatTimeout: {
        label: "Heartbeat Timeout",
        requireMessage: "Please enter heartbeat timeout",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.heartbeatTimeout</span> Heartbeat timeout duration. Unit: <span class='font-black text-[#5A3DAA]'>seconds</span>"
      },
      webServerPort: {
        label: "Web Port",
        requireMessage: "Please enter web port",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.webServerPort</span> Ensure the port is not occupied, otherwise it will cause the startup to fail"
      },
      transportProtocol: {
        label: "Transport Protocol",
        requireMessage: "Please enter transport protocol",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.protocol</span> The communication protocol between frps. The default is tcp."
      },
      transportDialServerTimeout: {
        label: "Dial Server Timeout",
        requireMessage: "Please enter dial server timeout",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.dialServerTimeout</span> Maximum waiting time to establish connection with server. Default value is 10 seconds. Unit: <span class='font-black text-[#5A3DAA]'>seconds</span>"
      },
      transportDialServerKeepalive: {
        label: "DS Keepalive",
        requireMessage: "Please enter dial server keepalive",
        tips: '{frpParameter}:<span class="font-black text-[#5A3DAA]">transport.dialServerKeepalive</span> When there is no data transmission between client and server for a certain period of time, the system will periodically send heartbeat packets to keep the connection active. If negative, keepalive probing is disabled. Unit: <span class="font-black text-[#5A3DAA]">seconds</span>'
      },
      transportPoolCount: {
        label: "Pool Count",
        requireMessage: "Please enter pool count"
      },
      transportTcpMux: {
        label: "TCP Mux",
        requireMessage: "Please enter TCP mux",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.tcpMux</span> Enable TCP multiplexing to improve performance"
      },
      transportTcpMuxKeepaliveInterval: {
        label: "TMux Keep Interval",
        requireMessage: "Please enter TCP mux keepalive interval",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.tcpMuxKeepaliveInterval</span> The keepalive interval for multiplexing, default value is 30 seconds. Unit: <span class='font-black text-[#5A3DAA]'>seconds</span>"
      },
      tlsCertFile: {
        label: "TLS Cert File",
        requireMessage: "Please select TLS cert file",
        placeholder: "Click to select TLS cert file"
      },
      tlsKeyFile: {
        label: "TLS Key File",
        requireMessage: "Please select TLS key file",
        placeholder: "Click to select TLS key file"
      },
      caCertFile: {
        label: "CA Cert File",
        requireMessage: "Please select CA cert file",
        placeholder: "Click to select CA cert file"
      },
      tlsServerName: {
        label: "TLS Server Name",
        requireMessage: "Please enter TLS server name",
        placeholder: "Enter TLS server name"
      },
      systemLanguage: {
        label: "System Language",
        requireMessage: "Please select system language"
      }
    },
    title: {
      versionSelection: "Version Selection",
      webInterface: "Web Server",
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
    modifyTitle: "Modify Proxy",
    createTitle: "Create Proxy",
    dialog: {
      listPorts: {
        title: "Inner Port",
        description: "Inner Port List",
        table: {
          columns: {
            protocol: "Protocol",
            ip: "IP",
            port: "Port"
          }
        }
      }
    },
    form: {
      modifyTitle: "Modify Proxy",
      createTitle: "Create Proxy",

      title: {
        basicConfig: "Basic Configuration",
        domainConfig: "Domain Configuration",
        proxyTransportConfig: "Proxy Transport Configuration",
        customConfig: "Custom Configuration",
        pluginConfig: "Plugin Configuration",
        otherConfig: "Other Proxy Configuration",
        modifyDialog: "Modify Proxy"
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
          requireMessage: "Please add at least one subdomain / custom domain",
          patternMessage: "Please enter a valid domain name"
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
          requireMessage: "Please enter bind port",
          description: "Bind the service of the visitor to which port"
        },
        transportUseEncryption: {
          label: "Encryption",
          requireMessage: "Please select whether to enable encryption",
          description: "Enable encryption for this proxy"
        },
        transportUseCompression: {
          label: "Compression",
          requireMessage: "Please select whether to enable compression",
          description: "Enable compression for this proxy"
        },
        transportProxyProtocolVersion: {
          label: "Proxy Protocol Version",
          description:
            "if not empty, frpc will use proxy protocol to transfer connection info to your local service",
          empty: "Empty"
        },
        bindAddr: {
          label: "Bind Address",
          requireMessage: "Please enter bind address",
          description:
            "To bind the service of the visitor to which <span class='font-black text-[#5A3DAA]'>IP</span> <br /> Only local access: <span class='font-black text-[#5A3DAA]'>127.0.0.1</span> <br /> Support LAN other devices access: <span class='font-black text-[#5A3DAA]'>0.0.0.0</span>"
        },
        secretKey: {
          label: "Secret Key",
          placeholder: "Secret key",
          requireMessage: "Please enter secret key",
          description:
            "Only users with the same secret key as the visitor and provider can access this service"
        },
        https2httpKeyFile: {
          label: "Key File",
          requireMessage: "Please select key file",
          placeholder: "Click to select key file"
        },
        serverName: {
          label: "Provider Proxy Name",
          requireMessage: "Please enter provider proxy name",
          placeholder: "stcp provider proxy name"
        },
        keepTunnelOpen: {
          label: "Keep Tunnel Open",
          requireMessage: "Please select whether to keep tunnel open",
          description: "Keep the tunnel open even if there is no traffic"
        },
        fallbackTo: {
          label: "Fallback stcp Proxy Name",
          requireMessage: "Please enter fallback stcp proxy name",
          description:
            "When xtcp hole punching fails, it will fall back to using stcp-visitor to establish a connection",
          placeholder: "stcp visitor proxy name"
        },
        fallbackTimeoutMs: {
          label: "Fallback Timeout Ms",
          requireMessage: "Please enter fallback timeout ms",
          description:
            "xtcp hole punching time exceeds this time will fall back to using stcp-visitor to establish a connection 单位：<span class='font-black text-[#5A3DAA]'>毫秒</span>"
        },
        locations: {
          label: "URL Path",
          requireMessage: "Please enter URL path",
          description: "URL path, supports regular expressions, e.g.: /api/.*"
        }
      }
    },
    message: {
      copySuccess: "Copy successfully",
      createSuccess: "Create successfully",
      modifySuccess: "Modify successfully"
    }
  },
  common: {
    yes: "Y",
    no: "N",
    modify: "Modify",
    delete: "Delete",
    more: "More",
    disable: "Disable",
    enable: "Enable",
    disabled: "Disabled",
    enabled: "Enabled",
    save: "Save",
    close: "Close",
    mode: "Mode",
    frpParameter: "Frp Parameter",
    operation: "Operation",
    select: "Select",
    deleteSuccess: "Delete successfully",
    modifySuccess: "Modify successfully",
    createSuccess: "Create successfully"
  }
};
