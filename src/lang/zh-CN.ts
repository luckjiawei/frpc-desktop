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
  }
};
