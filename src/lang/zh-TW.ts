export default {
  app: {
    title: "Frpc Desktop",
    description:
      "開機自動啟動 / 視覺化設定 / 免費開源，帶來更好的使用體驗。"
  },
  router: {
    home: {
      title: "儀表板"
    },
    tunnel: {
      title: "實例"
    },
    proxy: {
      title: "代理"
    },
    download: {
      title: "下載"
    },
    system: {
      title: "設定"
    },
    logger: {
      title: "記錄"
    },
    about: {
      title: "關於"
    }
  },
  layout: {
    navigation: "主導覽",
    memory: "記憶體",
    resourceUsageHint:
      "Frpc-Desktop 及其子行程。CPU：佔整體 CPU 容量的比例；記憶體：常駐記憶體總和。",
    collapseMenu: "收合側邊欄",
    expandMenu: "展開側邊欄",
    about: "關於 Frpc Desktop",
    guide: {
      home: "儀表板會彙整每個實例的執行狀態、代理數量與連線錯誤。",
      tunnel:
        "在這裡管理 frpc 實例：建立、啟動或中斷連線、開啟實例設定，或檢視其記錄。",
      proxy:
        "在這裡設定與管理代理。新增、編輯與刪除代理都可以在此頁面完成。",
      download: "從這裡下載最新版本的 frp。",
      system:
        "開機自動啟動、靜默啟動、自動連線與語言等全域選項都在這裡。",
      logger:
        "應用程式記錄在這裡；各實例的 frpc 記錄請至實例頁面查看。",
      version:
        "在這裡查看已安裝的 Frpc-Desktop 版本並檢查更新。",
      next: "下一步",
      prev: "上一步",
      done: "🎉 開始使用"
    },
    theme: {
      title: "外觀",
      light: "淺色",
      dark: "深色",
      auto: "跟隨系統"
    }
  },
  home: {
    uptime: {
      days: "{days}天 ",
      hours: "{hours}小時 ",
      minutes: "{minutes}分 ",
      seconds: "{seconds}秒"
    },
    dashboard: {
      notConfigured: "尚未設定伺服器",
      instances: "執行中的實例",
      instancesHint: "共 {total} 個",
      errors: "連線錯誤",
      errorsHint: "請至「實例」頁面查看記錄",
      noErrors: "一切正常",
      statusTitle: "實例狀態",
      manageInstances: "管理實例",
      noInstances: "沒有實例",
      status: "狀態",
      instance: "實例",
      proxies: "代理",
      proxiesValue: "已啟用 {enabled} / {total}",
      server: "伺服器",
      manage: "管理版本",
      frpcVersion: "frpc 版本",
      cloudflareManaged: "路由於 Cloudflare 中管理",
      tokenMissing: "尚未設定通道權杖"
    },
    status: {
      running: "執行中",
      disconnected: "已中斷連線",
      connectionError: "連線失敗",
      runningTime: "執行時間"
    },
    button: {
      start: "啟動",
      stop: "停止"
    },
    alert: {
      configRequired: {
        title: "提示",
        message: "請先前往設定頁面修改設定後再啟動",
        confirm: "前往設定"
      },
      versionNotFound: {
        title: "提示",
        message: "請先前往設定頁面選擇版本後再啟動",
        confirm: "前往設定"
      },
      webServerPortInUse: {
        title: "提示",
        message: "Web 伺服器連接埠已被佔用，請前往設定頁面更換連接埠",
        confirm: "前往設定"
      },
      visitorPortInUse: {
        title: "提示",
        message:
          "某個 Visitor 的綁定連接埠已被佔用（可能被其他實例使用）。請先修改代理設定再啟動",
        confirm: "前往代理"
      }
    }
  },
  system: {
    title: {
      data: "資料"
    },
    resetAllHint:
      "刪除所有實例、代理與系統設定。已下載的 frpc 版本會保留。",
    alert: {
      resetAll: {
        title: "重設所有設定",
        message:
          "所有實例將被停止並連同其代理一併刪除，系統設定也會還原為預設值。此操作無法復原，是否繼續？",
        confirm: "重設",
        cancel: "取消"
      }
    }
  },
  tunnel: {
    switcher: "切換實例",
    autoStart: "啟動時自動連線",
    autoStartHint:
      "另需在「設定」中啟用「啟動時自動連線」",
    empty: "尚無實例。建立一個實例即可開始使用。",
    noFrpc: "新增代理前，請先建立一個 frpc 實例。",
    log: {
      title: "{name} · 記錄"
    },
    config: {
      title: "{name} · 設定"
    },
    provider: {
      frpc: "frpc",
      cloudflared: "Cloudflare Tunnel",
      frpcDescription: "連線至你自己的 frps 伺服器",
      cloudflaredDescription: "透過 Cloudflare 網路公開服務"
    },
    meta: {
      connector: "連接器",
      routes: "路由",
      tokenConfigured: "已設定權杖",
      tokenMissing: "尚未設定通道權杖",
      routesInDashboard: "於 Cloudflare 儀表板中管理"
    },
    cloudflared: {
      tab: {
        instance: "實例",
        tunnel: "通道",
        client: "用戶端",
        advanced: "進階"
      },
      intro:
        "請在 Cloudflare 儀表板（Zero Trust → Networks → Tunnels）建立通道，連接器選擇「cloudflared」，並複製其權杖。公開主機名稱請在儀表板中設定。",
      openDashboard: "開啟 Cloudflare 儀表板",
      source: {
        label: "來源",
        downloaded: "已下載",
        custom: "本機檔案"
      },
      version: {
        label: "版本",
        placeholder: "選擇已下載的版本",
        empty: "沒有已下載的版本",
        autoHint:
          "若留空，將使用 PATH 中找到的 cloudflared（例如以 Homebrew 安裝的）"
      },
      customPath: {
        label: "檔案路徑",
        placeholder: "cloudflared 可執行檔的路徑",
        requireMessage: "請輸入 cloudflared 路徑",
        autoDetectSuccess: "已找到 cloudflared：",
        autoDetectNotFound: "在這台電腦上找不到 cloudflared",
        detectedVersion: "偵測到的版本"
      },
      token: {
        label: "通道權杖",
        placeholder: "貼上權杖，或貼上儀表板提供的完整安裝指令",
        requireMessage: "請輸入通道權杖",
        invalidMessage:
          "這看起來不像通道權杖。請從連接器的安裝指令中複製",
        extracted: "已從貼上的指令中擷取權杖"
      },
      protocol: {
        label: "通訊協定",
        auto: "自動（QUIC，失敗時改用 HTTP/2）",
        tips: "若你的網路封鎖 7844 連接埠的 UDP 流量，請選擇 HTTP/2"
      },
      edgeIpVersion: {
        label: "Edge IP 版本",
        auto: "自動"
      },
      logLevel: {
        label: "記錄等級"
      }
    },
    create: {
      title: "新增實例",
      name: "實例名稱",
      namePlaceholder: "例如：辦公室 frps",
      provider: "實例類型",
      method: "建立方式",
      manual: "手動填寫",
      manualDescription:
        "先建立實例，再開啟其設定填寫伺服器資訊",
      toml: "匯入 TOML",
      tomlDescription:
        "從 frpc.toml 建立實例、代理與 Visitor",
      link: "匯入連結",
      linkDescription: "貼上由 Frpc-Desktop 分享的 frp:// 設定連結",
      linkLabel: "設定連結",
      linkPlaceholder: "frp://...",
      linkInvalid: "連結無效，請貼上完整的 frp:// 連結",
      tomlHint:
        "點選「選擇檔案並建立」後再選取 frpc.toml。取消檔案選擇視窗則不會建立任何內容。",
      submitManual: "建立實例",
      submitToml: "選擇檔案並建立",
      submitLink: "從連結建立",
      failed: "建立實例失敗"
    },
    button: {
      create: "新增實例",
      startAll: "全部啟動",
      stopAll: "全部停止",
      config: "設定",
      proxies: "代理",
      logs: "記錄",
      copyLink: "複製連結",
      rename: "重新命名",
      delete: "刪除",
      more: "更多操作"
    },
    prompt: {
      renameTitle: "重新命名實例",
      nameLabel: "實例名稱",
      namePlaceholder: "例如：辦公室 frps",
      nameInvalid: "請輸入 1 至 64 個字元的名稱",
      confirm: "確定",
      cancel: "取消"
    },
    delete: {
      title: "刪除實例",
      frpcDescription:
        "此實例的設定及其所有代理都將被移除。若正在執行，會先停止。",
      cloudflaredDescription:
        "此實例的本機設定將被移除。若正在執行，會先停止。Cloudflare 儀表板中的通道與路由不受影響。",
      irreversible:
        "此操作無法復原，請在刪除前確認。",
      confirm: "刪除",
      cancel: "取消"
    },
    closeDirty: {
      title: "尚未儲存的變更",
      message:
        "此實例的設定尚未儲存，關閉後將會遺失。是否繼續？",
      confirm: "捨棄",
      cancel: "繼續編輯"
    },
    message: {
      createSuccess: "實例已建立",
      importSuccess:
        "設定已匯入為新實例，無須重新啟動應用程式。啟動前請先選擇 frpc 可執行檔。",
      copyLinkSuccess: "設定連結已複製，請妥善保管",
      copyLinkFailed: "複製設定連結失敗",
      renameSuccess: "實例已重新命名",
      deleteSuccess: "實例已刪除",
      launchAllFailed: "有 {count} 個實例啟動失敗：{detail}",
      saveSuccess: "已儲存，請重新啟動實例以套用變更"
    }
  },
  comingSoon: {
    description: "敬請期待"
  },
  download: {
    mirror: {
      placeholder: "下載代理"
    },
    viewMode: {
      card: "卡片",
      list: "列表"
    },
    provider: {
      label: "工具"
    },
    cloudflaredUnsupported:
      "沒有可用的 cloudflared 版本（處於離線狀態，或沒有此平台的建置版本）。你可以自行安裝 cloudflared，並在實例設定中選擇該檔案。",
    message: {
      deleteSuccess: "刪除成功",
      copyDownloadLinkSuccess: "下載連結已複製"
    },
    alert: {
      deleteConfirm: {
        title: "提示",
        message:
          '確定要刪除 <span class="font-bold text-primary">{name}</span> 嗎？',
        cancel: "取消",
        confirm: "刪除"
      }
    },
    version: {
      size: "大小",
      downloadCount: "下載次數",
      publishTime: "發佈時間",
      downloaded: "已下載",
      notDownloaded: "未下載",
      delete: "刪除",
      download: "下載",
      downloadLink: "下載連結",
      noVersions: "沒有可用的版本"
    }
  },
  logger: {
    message: {
      openSuccess: "已開啟記錄",
      refreshSuccess: "重新整理成功",
      copySuccess: "已將目前顯示的記錄複製到剪貼簿"
    },
    content: {
      empty: "沒有記錄",
      noMatch: "沒有符合的記錄"
    },
    search: {
      placeholder: "搜尋記錄..."
    },
    level: {
      all: "全部",
      error: "錯誤",
      warn: "警告",
      info: "資訊",
      debug: "除錯"
    },
    filter: {
      label: "依記錄等級篩選",
      clear: "清除篩選"
    },
    toolbar: {
      wrap: "切換自動換行",
      copy: "複製目前顯示的記錄"
    },
    status: {
      showing: "顯示 {shown} / {total} 筆",
      searching: "搜尋：{keyword}"
    },
    loading: {
      text: "載入中..."
    },
    refresh: "重新整理記錄",
    openFile: "開啟記錄檔案",
    autoRefresh: "自動重新整理",
    autoRefreshTime: "{time} 秒後自動重新整理"
  },
  about: {
    button: {
      doc: "說明文件",
      donate: "贊助",
      github: "Github",
      issues: "意見回饋"
    },
    features: {
      autoStart: "開機自動啟動",
      visualConfig: "視覺化設定",
      freeAndOpen: "免費開源"
    },
    description:
      "FRP 跨平台桌面用戶端，視覺化設定，輕鬆實現內網穿透！",
    version: {
      latest: "最新版本"
    },
    tips: {
      latestVersion: "目前已是最新版本"
    },
    update: {
      newVersion: "🎉 新版本 {version}",
      download: "下載"
    }
  },
  config: {
    form: {
      customFrpcPath: {
        label: "frpc 路徑",
        placeholder: "執行檔路徑，例如 ~/.local/bin/frpc，或點選「自動偵測」",
        tips: "指定本機已安裝的 frpc 執行檔（例如 <span class='font-black text-primary'>~/.local/bin/frpc</span>、<span class='font-black text-primary'>/usr/local/bin/frpc</span>），或點選「自動偵測」。",
        requireMessage: "請輸入 frpc 路徑，或點選「自動偵測」",
        detectedVersion: "偵測到的版本",
        autoDetectSuccess: "已自動偵測到 frpc：",
        autoDetectNotFound:
          "未偵測到可執行的 frpc。請確認已安裝，或改用已下載的版本。",
        invalidPath:
          "指定的路徑不存在，或沒有執行權限"
      },
      frpcSource: {
        label: "frpc 來源",
        downloaded: "已下載的版本",
        custom: "自訂路徑"
      },
      frpcVerson: {
        label: "已下載的版本",
        placeholder: "選擇已下載的 frpc 版本",
        empty: "尚無已下載的版本",
        requireMessage: "請選擇已下載的 frpc 版本"
      },
      serverAddr: {
        label: "伺服器位址",
        requireMessage: "請輸入伺服器位址",
        patternMessage: "請輸入正確的伺服器位址",
        tips: "{frpParameter}：<span class='font-black text-primary'>serverAddr</span> frps 服務位址，支援<span class='font-black text-primary'>網域名稱</span>、<span class='font-black text-primary'>IP</span>"
      },
      serverPort: {
        label: "伺服器連接埠",
        requireMessage: "請輸入伺服器連接埠"
      },
      user: {
        label: "使用者",
        requireMessage: "請輸入使用者",
        placeholder: "請輸入使用者"
      },
      multiuser: {
        label: "多使用者",
        requireMessage: "請選擇是否啟用多使用者"
      },
      metadatasToken: {
        label: "使用者權杖",
        requireMessage: "請輸入使用者權杖",
        placeholder: "請輸入使用者權杖"
      },
      metadatas: {
        label: "自訂中繼資料",
        description:
          "透過 [metadatas] 表傳送給 frps 的鍵值對。多使用者模式下，權杖請在上方設定。",
        keyPlaceholder: "鍵",
        valuePlaceholder: "值",
        valueLabel: "{key} 的值",
        newKeyLabel: "新的中繼資料鍵",
        newValueLabel: "新的中繼資料值",
        add: "新增",
        remove: "移除中繼資料",
        empty: "沒有自訂中繼資料",
        keyRequired: "請輸入中繼資料鍵",
        keyDuplicate: "此中繼資料鍵已存在",
        keyReserved: "多使用者模式下，權杖請在上方設定"
      },
      authMethod: {
        label: "驗證方式",
        requireMessage: "請選擇驗證方式",
        none: "無",
        token: "權杖"
      },
      authToken: {
        label: "權杖",
        requireMessage: "請輸入權杖"
      },
      logLevel: {
        label: "記錄等級",
        requireMessage: "請選擇記錄等級"
      },
      logMaxDays: {
        label: "記錄保留天數",
        requireMessage: "請輸入記錄保留天數"
      },
      tlsEnable: {
        label: "TLS",
        requireMessage: "請選擇 TLS"
      },
      transportProxyURL: {
        label: "代理 URL",
        requireMessage: "請輸入代理 URL",
        patternMessage: "請輸入正確的代理 URL"
      },
      systemLaunchAtStartup: {
        label: "開機自動啟動",
        requireMessage: "請選擇是否開機自動啟動",
        tips: "系統啟動時自動啟動本軟體"
      },
      systemSilentStartup: {
        label: "靜默啟動",
        requireMessage: "請選擇是否啟用靜默啟動",
        tips: "靜默啟動時，系統開機後不會顯示任何介面"
      },
      systemAutoConnectOnStartup: {
        label: "自動連線",
        requireMessage: "請選擇是否啟用自動連線",
        tips: "系統啟動時自動連線至伺服器"
      },
      transportHeartbeatInterval: {
        label: "心跳間隔",
        requireMessage: "請輸入心跳間隔",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.heartbeatInterval</span> 向伺服器傳送心跳封包的間隔。單位：<span class='font-black text-primary'>秒</span>"
      },
      transportHeartbeatTimeout: {
        label: "心跳逾時",
        requireMessage: "請輸入心跳逾時",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.heartbeatTimeout</span> 心跳逾時時間。單位：<span class='font-black text-primary'>秒</span>"
      },
      webServerEnable: {
        label: "Web 介面開關",
        tips: "是否啟用 frpc 內建的 Web 管理主控台"
      },
      webServerPort: {
        label: "Web 連接埠",
        requireMessage: "請輸入 Web 連接埠",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.webServerPort</span> 請確保該連接埠未被佔用，否則會導致啟動失敗"
      },
      transportProtocol: {
        label: "傳輸協定",
        requireMessage: "請輸入傳輸協定",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.protocol</span> 與 frps 之間的通訊協定，預設為 tcp。"
      },
      transportDialServerTimeout: {
        label: "連線伺服器逾時",
        requireMessage: "請輸入連線伺服器逾時",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.dialServerTimeout</span> 與伺服器建立連線的最長等待時間，預設為 10 秒。單位：<span class='font-black text-primary'>秒</span>"
      },
      transportDialServerKeepalive: {
        label: "連線保活",
        requireMessage: "請輸入連線伺服器保活間隔",
        tips: '{frpParameter}：<span class="font-black text-primary">transport.dialServerKeepalive</span> 當用戶端與伺服器之間一段時間沒有資料傳輸時，系統會定期傳送心跳封包以保持連線。若為負數，則停用保活探測。單位：<span class="font-black text-primary">秒</span>'
      },
      transportPoolCount: {
        label: "連線池數量",
        requireMessage: "請輸入連線池數量"
      },
      transportTcpMux: {
        label: "TCP 多工",
        requireMessage: "請輸入 TCP 多工",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.tcpMux</span> 啟用 TCP 多工以提升效能"
      },
      transportTcpMuxKeepaliveInterval: {
        label: "多工保活間隔",
        requireMessage: "請輸入 TCP 多工保活間隔",
        tips: "{frpParameter}：<span class='font-black text-primary'>transport.tcpMuxKeepaliveInterval</span> 多工的保活間隔，預設為 30 秒。單位：<span class='font-black text-primary'>秒</span>"
      },
      tlsCertFile: {
        label: "TLS 憑證檔案",
        requireMessage: "請選擇 TLS 憑證檔案",
        placeholder: "點選選擇 TLS 憑證檔案"
      },
      tlsKeyFile: {
        label: "TLS 金鑰檔案",
        requireMessage: "請選擇 TLS 金鑰檔案",
        placeholder: "點選選擇 TLS 金鑰檔案"
      },
      caCertFile: {
        label: "CA 憑證檔案",
        requireMessage: "請選擇 CA 憑證檔案",
        placeholder: "點選選擇 CA 憑證檔案"
      },
      tlsServerName: {
        label: "TLS 伺服器名稱",
        requireMessage: "請輸入 TLS 伺服器名稱",
        placeholder: "輸入 TLS 伺服器名稱"
      },
      systemLanguage: {
        label: "系統語言",
        requireMessage: "請選擇系統語言",
        options: {
          zhCN: "簡體中文",
          zhTW: "繁體中文",
          enUS: "英文"
        }
      },
      appLogLevel: {
        label: "應用程式記錄等級",
        tips: "控制應用程式記錄的詳細程度。各實例的 frpc 與 cloudflared 記錄等級請在各自的設定中另行設定。"
      }
    },
    tab: {
      instance: "實例",
      server: "伺服器",
      transport: "傳輸",
      web: "Web 伺服器",
      log: "記錄"
    },
    title: {
      versionSelection: "版本選擇",
      webInterface: "Web 伺服器",
      transportConfiguration: "傳輸設定",
      logConfiguration: "記錄設定",
      systemConfiguration: "系統設定",
      serverConfiguration: "伺服器設定"
    },
    button: {
      autoDetect: "自動偵測",
      browse: "瀏覽...",
      manualRefresh: "手動重新整理",
      goToDownload: "點選此處下載",
      clear: "清除",
      openData: "開啟資料目錄",
      resetAll: "重設所有設定",
      exportConfig: "匯出設定",
      saveWithShortcut: "儲存 (Ctrl+S / ⌘S)"
    },
    alert: {
      resetConfig: {
        title: "提示",
        message: "確定要重設設定嗎？",
        confirm: "確定",
        cancel: "取消"
      },
      resetConfigSuccess: {
        title: "提示",
        message: "重設成功，請重新啟動軟體",
        confirm: "立即重新啟動"
      },
      multiuserAlert: {
        title: "提示",
        message:
          "多使用者外掛程式需要 Frp 版本 >= <span class='font-black text-primary'>v0.31.0</span>，請選擇正確的版本。",
        confirm: "知道了"
      },
      exportConfigSuccess: {
        title: "提示",
        message: "設定路徑：{path}"
      }
    },
    message: {
      openAppDataSuccess: "已開啟資料目錄",
      saveSuccess: "儲存成功"
    },
    popover: {
      frpParameter: "Frp 參數"
    }
  },
  proxy: {
    inner: "內部",
    mappingAddress: "對應位址",
    visitors: "Visitors",
    visitorsProvider: "Visitors 提供端",
    copyAddress: "複製位址",
    visitorsName: "Visitors 名稱",
    noProxy: "沒有代理",
    search: "依名稱 / 類型 / IP / 連接埠 / 網域名稱搜尋",
    viewMode: {
      card: "卡片",
      list: "列表"
    },
    modifyTitle: "修改代理",
    createTitle: "建立代理",
    dialog: {
      listPorts: {
        title: "內部連接埠",
        description: "內部連接埠清單",
        table: {
          columns: {
            protocol: "協定",
            ip: "IP",
            port: "連接埠"
          }
        }
      }
    },
    form: {
      modifyTitle: "修改代理",
      createTitle: "建立代理",

      title: {
        basicConfig: "基本設定",
        domainConfig: "網域設定",
        proxyTransportConfig: "代理傳輸設定",
        customConfig: "自訂設定",
        pluginConfig: "外掛程式設定",
        otherConfig: "其他代理設定",
        modifyDialog: "修改代理"
      },
      pluginType: {
        none: "不使用外掛程式"
      },
      button: {
        localPort: "本機連接埠",
        generateName: "產生"
      },
      formItem: {
        proxyType: {
          label: "代理類型",
          requireMessage: "請選擇代理類型"
        },
        visitorsModel: {
          requireMessage: "請選擇模式"
        },
        name: {
          label: "代理名稱",
          requireMessage: "請輸入代理名稱",
          placeholder: "請輸入代理名稱"
        },
        localIP: {
          label: "本機 IP",
          requireMessage: "請輸入本機 IP",
          patternMessage: "請輸入有效的本機位址"
        },
        localPort: {
          label: "本機連接埠",
          requireMessage: "請輸入本機連接埠",
          patternMessage: "請輸入有效的本機連接埠"
        },
        remotePort: {
          label: "遠端連接埠",
          requireMessage: "請輸入遠端連接埠",
          patternMessage: "請輸入有效的遠端連接埠"
        },
        subdomain: {
          label: "子網域",
          requireMessage: "請輸入子網域"
        },
        customDomains: {
          label: "自訂網域",
          requireMessage: "請至少新增一個子網域 / 自訂網域",
          patternMessage: "請輸入有效的網域名稱"
        },
        basicAuth: {
          label: "HTTP 基本驗證",
          requireMessage: "請選擇是否啟用 HTTP 基本驗證"
        },
        httpUser: {
          label: "驗證使用者名稱",
          requireMessage: "請輸入驗證使用者名稱"
        },
        httpPassword: {
          label: "驗證密碼",
          requireMessage: "請輸入驗證密碼"
        },
        https2httpCaFile: {
          label: "憑證檔案",
          requireMessage: "請選擇憑證檔案",
          placeholder: "點選選擇憑證檔案"
        },
        bindPort: {
          label: "綁定連接埠",
          requireMessage: "請輸入綁定連接埠",
          patternMessage: "請輸入有效的綁定連接埠",
          description: "將 Visitor 的服務綁定到哪個連接埠"
        },
        transportUseEncryption: {
          label: "加密",
          requireMessage: "請選擇是否啟用加密",
          description: "為此代理啟用加密"
        },
        transportUseCompression: {
          label: "壓縮",
          requireMessage: "請選擇是否啟用壓縮",
          description: "為此代理啟用壓縮"
        },
        transportProxyProtocolVersion: {
          label: "Proxy Protocol 版本",
          description:
            "若不為空，frpc 會使用 proxy protocol 將連線資訊傳遞給你的本機服務",
          empty: "空"
        },
        bindAddr: {
          label: "綁定位址",
          requireMessage: "請輸入綁定位址",
          patternMessage: "請輸入有效的綁定位址",
          description:
            "將 Visitor 的服務綁定到哪個 <span class='font-black text-primary'>IP</span> <br /> 僅限本機存取：<span class='font-black text-primary'>127.0.0.1</span> <br /> 支援區域網路內其他裝置存取：<span class='font-black text-primary'>0.0.0.0</span>"
        },
        secretKey: {
          label: "金鑰",
          placeholder: "金鑰",
          requireMessage: "請輸入金鑰",
          description:
            "只有與 Visitor 和提供端使用相同金鑰的使用者才能存取此服務"
        },
        https2httpKeyFile: {
          label: "金鑰檔案",
          requireMessage: "請選擇金鑰檔案",
          placeholder: "點選選擇金鑰檔案"
        },
        tls2rawCaFile: {
          label: "憑證檔案",
          requireMessage: "請選擇憑證檔案",
          placeholder: "點選選擇憑證檔案"
        },
        tls2rawKeyFile: {
          label: "金鑰檔案",
          requireMessage: "請選擇金鑰檔案",
          placeholder: "點選選擇金鑰檔案"
        },
        pluginType: {
          label: "外掛程式類型"
        },
        serverName: {
          label: "提供端代理名稱",
          requireMessage: "請輸入提供端代理名稱",
          placeholder: "stcp 提供端代理名稱"
        },
        serverUser: {
          label: "伺服器使用者",
          requireMessage: "請輸入伺服器使用者",
          placeholder: "伺服器使用者",
          description:
            "存取由其他伺服器使用者建立的提供端代理時請填寫此欄位；留空則使用目前的伺服器使用者。"
        },
        keepTunnelOpen: {
          label: "保持通道開啟",
          requireMessage: "請選擇是否保持通道開啟",
          description: "即使沒有流量也保持通道開啟"
        },
        fallbackTo: {
          label: "備援 stcp 代理名稱",
          requireMessage: "請輸入備援 stcp 代理名稱",
          description:
            "xtcp 打洞失敗時，會改用 stcp-visitor 建立連線",
          placeholder: "stcp visitor 代理名稱"
        },
        fallbackTimeoutMs: {
          label: "備援逾時（毫秒）",
          requireMessage: "請輸入備援逾時毫秒數",
          description:
            "xtcp 打洞時間超過此時間時，會改用 stcp-visitor 建立連線。單位：<span class='font-black text-primary'>毫秒</span>"
        },
        locations: {
          label: "URL 路徑",
          requireMessage: "請輸入 URL 路徑",
          description: "URL 路徑，支援規則運算式，例如：/api/.*"
        }
      }
    },
    message: {
      copySuccess: "複製成功",
      copyFailed: "複製失敗",
      portCountMismatch:
        "請確保本機連接埠的數量與遠端連接埠的數量一致",
      createSuccess: "建立成功",
      modifySuccess: "修改成功"
    }
  },
  common: {
    yes: "是",
    no: "否",
    modify: "修改",
    delete: "刪除",
    more: "更多",
    disable: "停用",
    enable: "啟用",
    disabled: "已停用",
    enabled: "已啟用",
    cancel: "取消",
    save: "儲存",
    close: "關閉",
    mode: "模式",
    status: "狀態",
    frpParameter: "Frp 參數",
    operation: "操作",
    select: "選擇",
    clear: "清除",
    deleteSuccess: "刪除成功",
    modifySuccess: "修改成功",
    createSuccess: "建立成功"
  }
};
