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
  }
};
