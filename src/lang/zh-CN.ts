export default {
  app: {
    title: "Frpc Desktop",
    description: "开机自启 / 可视化配置 / 免费开源，提供便捷的使用体验。"
  },
  router: {
    home: {
      title: "主页"
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
        label: "Frp版本",
        requireMessage: "请选择Frp版本"
      },
      serverAddr: {
        label: "服务端地址",
        requireMessage: "请输入服务端地址",
        patternMessage: "请输入正确的服务端地址"
      },
      serverPort: {
        label: "服务器端口",
        requireMessage: "请输入服务器端口"
      },
      user: {
        label: "用户",
        requireMessage: "请输入用户"
      },
      multiuser: {
        label: "多用户",
        requireMessage: "请选择是否开启多用户"
      },
      metadatasToken: {
        label: "用户令牌",
        requireMessage: "请输入多用户令牌"
      },
      authMethod: {
        label: "验证方式",
        requireMessage: "请选择验证方式"
      },
      authToken: {
        label: "Token值",
        requireMessage: "请输入Token值"
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
        label: "TLS状态",
        requireMessage: "请选择TLS状态"
      },
      transportProxyURL: {
        label: "代理地址",
        requireMessage: "请输入代理地址",
        patternMessage: "请输入正确的代理地址"
      },
      systemLaunchAtStartup: {
        label: "开机自启",
        requireMessage: "请选择是否开机自启"
      },
      systemSilentStartup: {
        label: "静默启动",
        requireMessage: "请选择是否开启静默启动"
      },
      systemAutoConnectOnStartup: {
        label: "自动连接",
        requireMessage: "请选择是否开启自动连接"
      },
      transportHeartbeatInterval: {
        label: "心跳间隔时间",
        requireMessage: "心跳间隔时间不能为空"
      },
      transportHeartbeatTimeout: {
        label: "心跳超时时间",
        requireMessage: "心跳超时时间不能为空"
      },
      webServerPort: {
        label: "Web端口",
        requireMessage: "web界面端口不能为空"
      },
      transportProtocol: {
        label: "传输协议",
        requireMessage: "传输协议不能为空"
      },
      transportDialServerTimeout: {
        label: "连接超时",
        requireMessage: "连接超时不能为空"
      },
      transportDialServerKeepalive: {
        label: "连接保活",
        requireMessage: "连接保活不能为空"
      },
      transportPoolCount: {
        label: "连接池数量",
        requireMessage: "连接池数量不能为空"
      },
      transportTcpMux: {
        label: "TCP复用",
        requireMessage: "TCP复用不能为空"
      },
      transportTcpMuxKeepaliveInterval: {
        label: "多复心跳间隔",
        requireMessage: "多复心跳间隔不能为空"
      }
    },
    title: {
      versionSelection: "版本选择",
      webInterface: "Web 界面",
      transportConfiguration: "传输配置",
      logConfiguration: "日志配置",
      systemConfiguration: "系统配置"
    },
    button: {
      manualRefresh: "手动刷新",
      goToDownload: "点击这里去下载",
      clear: "清除"
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
        message: "配置路径：{path}",
      }
    },
    message: {
      invalidLink: "链接不正确 请输入正确的链接",
      openAppDataSuccess: "打开数据目录成功",
      saveSuccess: "保存成功"
    }
  }
};
