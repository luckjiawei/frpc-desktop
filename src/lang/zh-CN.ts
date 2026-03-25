export default {
  app: {
    title: "Frpc Desktop",
    description: "开机自启 / 可视化配置 / 免费开源，提供便捷的使用体验。"
  },
  router: {
    home: {
      title: "启动"
    },
    proxy: {
      title: "代理"
    },
    download: {
      title: "下载"
    },
    config: {
      title: "设置"
    },
    logger: {
      title: "日志"
    },
    about: {
      title: "关于"
    }
  },
  home: {
    uptime: {
      days: "{days}天",
      hours: "{hours}小时",
      minutes: "{minutes}分钟",
      seconds: "{seconds}秒"
    },
    status: {
      running: "已启动",
      disconnected: "已断开",
      connectionError: "连接失败",
      runningTime: "已运行",
      frpcStatus: "Frpc {status}"
    },
    button: {
      start: "启 动",
      stop: "断 开",
      viewLog: "查看日志"
    },
    alert: {
      configRequired: {
        title: "提示",
        message: "请先前往设置页面，修改配置后再启动",
        confirm: "去设置"
      },
      versionNotFound: {
        title: "提示",
        message: "请先前往设置页面，选择版本后再启动",
        confirm: "去设置"
      },
      webServerPortInUse: {
        title: "提示",
        message: "Web界面端口已被占用，请前往设置页面更换 Web界面端口后再启动",
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
      deleteSuccess: "删除成功",
      copyDownloadLinkSuccess: "复制下载链接成功"
    },
    alert: {
      deleteConfirm: {
        title: "提示",
        message:
          '确认要删除 <span class="font-bold text-primary">{name}</span> 吗？',
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
      download: "下载",
      downloadLink: "下载链接",
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
    },
    tab: {
      appLog: "应用日志",
      frpcLog: "连接日志"
    },
    search: {
      placeholder: "搜索日志内容..."
    },
    loading: {
      text: "加载中..."
    },
    autoRefresh: "自动刷新",
    autoRefreshTime: "{time}秒 后自动刷新"
  },
  about: {
    button: {
      doc: "使用教程",
      donate: "捐赠名单",
      github: "GitHub",
      issues: "反馈问题"
    },
    features: {
      autoStart: "开机自启",
      visualConfig: "可视化配置",
      freeAndOpen: "免费开源"
    },
    description: "FRP跨平台桌面客户端，可视化配置，轻松实现内网穿透！",
    version: {
      latest: "最新版本"
    },
    tips: {
      latestVersion: "当前已是最新版本"
    }
  },
  config: {
    form: {
      frpcVerson: {
        label: "Frp版本",
        requireMessage: "请选择Frp版本"
      },
      serverAddr: {
        label: "服务端地址",
        requireMessage: "请输入服务端地址",
        patternMessage: "请输入正确的服务端地址",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>serverAddr</span> Frps服务端地址 支持 <span class='font-black text-[#5A3DAA]'>域名</span>、<span class='font-black text-[#5A3DAA]'>IP</span>"
      },
      serverPort: {
        label: "服务器端口",
        requireMessage: "请输入服务器端口"
      },
      user: {
        label: "用户",
        requireMessage: "请输入用户",
        placeholder: "请输入用户"
      },
      multiuser: {
        label: "多用户",
        requireMessage: "请选择是否开启多用户"
      },
      metadatasToken: {
        label: "用户令牌",
        requireMessage: "请输入多用户令牌",
        placeholder: "请输入多用户令牌"
      },
      authMethod: {
        label: "验证方式",
        requireMessage: "请选择验证方式",
        none: "无",
        token: "令牌"
      },
      authToken: {
        label: "令牌",
        requireMessage: "请输入令牌"
      },
      logLevel: {
        label: "日志级别",
        requireMessage: "请选择日志级别"
      },
      logMaxDays: {
        label: "日志保留天数",
        requireMessage: "请输入日志保留天数"
      },
      tlsEnable: {
        label: "TLS",
        requireMessage: "请选择TLS"
      },
      transportProxyURL: {
        label: "代理地址",
        requireMessage: "请输入代理地址",
        patternMessage: "请输入正确的代理地址"
      },
      systemLaunchAtStartup: {
        label: "开机自启",
        requireMessage: "请选择是否开机自启",
        tips: " 开启后开机时自动启动 Frpc-Desktop"
      },
      systemSilentStartup: {
        label: "静默启动",
        requireMessage: "请选择是否开启静默启动",
        tips: " 开启后启动时<span class='font-black text-[#5A3DAA]'>不打开界面</span>"
      },
      systemAutoConnectOnStartup: {
        label: "自动连接",
        requireMessage: "请选择是否开启自动连接",
        tips: " 开启后启动时<span class='font-black text-[#5A3DAA]'>自动连接</span>"
      },
      transportHeartbeatInterval: {
        label: "心跳间隔时间",
        requireMessage: "心跳间隔时间不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.heartbeatInterval</span> 多长向服务端发发送一次心跳包 单位：<span class='font-black text-[#5A3DAA]'>秒</span>"
      },
      transportHeartbeatTimeout: {
        label: "心跳超时时间",
        requireMessage: "心跳超时时间不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.heartbeatTimeout</span> 心跳超时时间 单位：<span class='font-black text-[#5A3DAA]'>秒</span>"
      },
      webServerPort: {
        label: "Web端口",
        requireMessage: "web界面端口不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.webServerPort</span> 自行保证端口没有被占用，否则会导致启动失败"
      },
      transportProtocol: {
        label: "传输协议",
        requireMessage: "传输协议不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.protocol</span> 与 frps 之间的通信协议。默认为 tcp。"
      },
      transportDialServerTimeout: {
        label: "连接超时",
        requireMessage: "连接超时不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.dialServerTimeout</span> 与服务器建立连接的最长等待时间。默认值为10秒。单位：<span class='font-black text-[#5A3DAA]'>秒</span>"
      },
      transportDialServerKeepalive: {
        label: "保活探测间隔",
        requireMessage: "保活探测间隔不能为空",
        tips: '{frpParameter}:<span class="font-black text-[#5A3DAA]">transport.dialServerKeepalive</span> 客户端与服务端之间的连接在一定时间内没有任何数据传输，系统会定期发送一些心跳数据包来保持连接的活跃状态。如果为负，则禁用保活探测。单位：<span class="font-black text-[#5A3DAA]">秒</span>'
      },
      transportPoolCount: {
        label: "连接池数量",
        requireMessage: "连接池数量不能为空"
      },
      transportTcpMux: {
        label: "TCP复用",
        requireMessage: "TCP复用不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.tcpMux</span> TCP 多路复用，默认启用。"
      },
      transportTcpMuxKeepaliveInterval: {
        label: "多复心跳间隔",
        requireMessage: "多复心跳间隔不能为空",
        tips: "{frpParameter}:<span class='font-black text-[#5A3DAA]'>transport.tcpMuxKeepaliveInterval</span> 多路复用的保活间隔，默认值为 30 秒。单位：<span class='font-black text-[#5A3DAA]'>秒</span>"
      },
      tlsCertFile: {
        label: "TLS证书文件",
        requireMessage: "请选择TLS证书文件",
        placeholder: "点击选择 TLS 证书文件"
      },
      tlsKeyFile: {
        label: "TLS密钥文件",
        requireMessage: "请选择TLS密钥文件",
        placeholder: "点击选择 TLS 密钥文件"
      },
      caCertFile: {
        label: "CA证书文件",
        requireMessage: "请选择CA证书文件",
        placeholder: "点击选择 CA 证书文件"
      },
      tlsServerName: {
        label: "TLS Server 名称",
        requireMessage: "请输入TLS Server 名称",
        placeholder: "请输入TLS Server 名称"
      },
      systemLanguage: {
        label: "系统语言",
        requireMessage: "请选择系统语言"
      }
    },
    title: {
      versionSelection: "版本选择",
      webInterface: "Web 界面",
      transportConfiguration: "传输配置",
      logConfiguration: "日志配置",
      systemConfiguration: "系统配置",
      serverConfiguration: "服务器配置"
    },
    button: {
      manualRefresh: "手动刷新",
      goToDownload: "点击这里去下载",
      clear: "清除",
      import: "导入"
    },
    alert: {
      resetConfig: {
        title: "提示",
        message: "确定要重置配置吗？",
        confirm: "确定",
        cancel: "取消"
      },
      resetConfigSuccess: {
        title: "提示",
        message: "重置成功 请重启软件",
        confirm: "立即重启"
      },
      importTomlConfigSuccess: {
        title: "提示",
        message: "🎉 恭喜你，导入成功 请重启软件",
        confirm: "立即重启"
      },
      multiuserAlert: {
        title: "提示",
        message:
          "多用户插件需要 Frp版本 >= <span class='font-black text-[#5A3DAA]'>v0.31.0</span> 请自行选择正确版本",
        confirm: "知道了"
      },
      exportConfigSuccess: {
        title: "🎉 导出成功",
        message: "配置路径：{path}"
      }
    },
    message: {
      invalidLink: "链接不正确 请输入正确的链接",
      openAppDataSuccess: "打开数据目录成功",
      saveSuccess: "保存成功"
    },
    popover: {
      frpParameter: "Frp参数"
    },
    dialog: {
      importLink: {
        title: "导入链接"
      },
      copyLink: {
        title: "复制链接",
        message: "复制成功",
        warning: {
          message:
            "生成内容包含服务器密钥等内容 请妥善保管 且链接仅在Frpc-Desktop中可用"
        }
      }
    }
  },
  common: {
    yes: "是",
    no: "否",
    modify: "修改",
    delete: "删除",
    more: "更多",
    disable: "禁用",
    enable: "启用",
    disabled: "已禁用",
    enabled: "已启用",
    close: "关闭",
    save: "保存",
    mode: "模式",
    selectMode: "请选择{mode}模式",
    operation: "操作",
    select: "选择",
    frpParameter: "frp参数",
    deleteSuccess: "删除成功",
    modifySuccess: "修改成功"
  },
  proxy: {
    inner: "内网",
    mappingAddress: "映射地址",
    visitors: "访问者",
    visitorsProvider: "提供者",
    visitorsName: "访问者名称",
    noProxy: "暂无代理",
    search: "搜索名称/类型/IP/端口/域名",
    modifyTitle: "编辑代理",
    createTitle: "添加代理",
    message: {
      copySuccess: "复制成功"
    },
    dialog: {
      listPorts: {
        title: "内网端口",
        description: "内网端口列表",
        table: {
          columns: {
            protocol: "协议",
            ip: "IP",
            port: "端口",
            operation: "操作"
          }
        }
      }
    },

    form: {
      title: {
        basicConfig: "基础配置",
        domainConfig: "域名配置",
        proxyTransportConfig: "代理传输配置",
        customConfig: "自定义配置",
        pluginConfig: "插件配置",
        otherConfig: "其他代理配置"
      },
      button: {
        localPort: "本机端口",
        generateName: "生成"
      },
      formItem: {
        proxyType: {
          label: "代理类型",
          requireMessage: "请选择代理类型"
        },
        name: {
          label: "代理名称",
          requireMessage: "请输入代理名称",
          placeholder: "请输入代理名称"
        },
        localIP: {
          label: "内网地址",
          requireMessage: "请输入内网地址",
          patternMessage: "请输入正确的内网地址"
        },
        localPort: {
          label: "内网端口",
          requireMessage: "请输入内网端口",
          patternMessage: "请输入正确的内网端口"
        },
        remotePort: {
          label: "外网端口",
          requireMessage: "请输入外网端口",
          patternMessage: "请输入正确的外网端口"
        },
        subdomain: {
          label: "子域名",
          requireMessage: "请输入子域名"
        },
        customDomains: {
          label: "自定义域名",
          requireMessage: "请至少添加一个 子域名 / 自定义域名",
          patternMessage: "请输入正确的域名"
        },
        basicAuth: {
          label: "HTTP基本认证",
          requireMessage: "请选择是否开启HTTP基本认证"
        },
        httpUser: {
          label: "认证用户名",
          requireMessage: "请输入认证用户名"
        },
        httpPassword: {
          label: "认证密码",
          requireMessage: "请输入认证密码"
        },
        https2httpCaFile: {
          label: "证书文件",
          requireMessage: "请选择证书文件",
          placeholder: "点击选择证书文件"
        },
        bindPort: {
          label: "绑定端口",
          requireMessage: "请输入绑定端口",
          patternMessage: "请输入正确的绑定端口",
          description:
            "要将被访问者的服务绑定到本地哪个<span class='font-black text-[#5A3DAA]'>端口</span><br />请自行确保端口未被占用"
        },
        transportUseEncryption: {
          label: "加密传输",
          requireMessage: "请选择是否开启加密传输",
          description: "开启后，此代理的流量将被加密"
        },
        transportUseCompression: {
          label: "压缩传输",
          requireMessage: "请选择是否开启压缩传输",
          description: "开启后，此代理的流量将被压缩"
        },
        transportProxyProtocolVersion: {
          label: "代理协议版本",
          description: "如果非空，frpc将使用代理协议传输连接信息到本地服务",
          empty: "空"
        },
        bindAddr: {
          label: "绑定地址",
          requireMessage: "请输入绑定地址",
          patternMessage: "请输入正确的绑定地址",
          description:
            "要将被访问者的服务绑定到本地哪个<span class='font-black text-[#5A3DAA]'>IP</span> <br /> 仅本机访问：<span class='font-black text-[#5A3DAA]'>127.0.0.1</span> <br /> 支持局域网其他设备访问：<span class='font-black text-[#5A3DAA]'>0.0.0.0</span>"
        },
        secretKey: {
          label: "共享密钥",
          placeholder: "共享密钥",
          requireMessage: "请输入共享密钥",
          description: "只有访问者与被访问者共享密钥一致的用户才能访问该服务"
        },
        https2httpKeyFile: {
          label: "密钥文件",
          requireMessage: "请选择密钥文件",
          placeholder: "点击选择密钥文件"
        },
        serverName: {
          label: "提供者代理名称",
          requireMessage: "请输入提供者代理名称",
          placeholder: "提供者代理名称"
        },
        keepTunnelOpen: {
          label: "保持隧道开启",
          requireMessage: "请选择是否保持隧道开启",
          description: "开启后，即使没有流量通过会保持隧道(即连接)打开。"
        },
        fallbackTo: {
          label: "回退stcp代理名称",
          requireMessage: "请输入回退stcp代理名称",
          description: "当 xtcp 打洞失败时，会回退到使用 stcp-visitor 建立连接",
          placeholder: "stcp 访问者代理名称"
        },
        fallbackTimeoutMs: {
          label: "回退超时毫秒",
          requireMessage: "请输入回退超时毫秒",
          description:
            "xtcp 打洞时间超过该时间会回退到使用 stcp-visitor 建立连接 单位：<span class='font-black text-[#5A3DAA]'>毫秒</span>"
        },
        locations: {
          label: "URL 路径",
          requireMessage: "请输入 URL 路径",
          description: "URL 路径,支持正则表达式,如: /api/.*"
        }
      }
    }
  }
};
