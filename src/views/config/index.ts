import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import confetti from "canvas-confetti/src/confetti.js";
import { IPCChannels } from "../../../electron/core/constant";
import { ElMessage, ElMessageBox, FormInstance, FormRules } from "element-plus";
import { Base64 } from "js-base64";
import _ from "lodash";
import { onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const defaultFormData: OpenSourceFrpcDesktopConfiguration = {
  id: null,
  multiuser: false,
  frpcVersion: null,
  loginFailExit: false,
  udpPacketSize: 1500,
  serverAddr: "",
  serverPort: 7000,
  auth: {
    method: "",
    token: ""
  },
  log: {
    to: "",
    level: "info",
    maxDays: 3,
    disablePrintColor: false
  },
  transport: {
    dialServerTimeout: 10,
    dialServerKeepalive: 7200,
    poolCount: 0,
    tcpMux: true,
    tcpMuxKeepaliveInterval: 30,
    protocol: "tcp",
    connectServerLocalIP: "",
    proxyURL: "",
    tls: {
      enable: true,
      certFile: "",
      keyFile: "",
      trustedCaFile: "",
      serverName: "",
      disableCustomTLSFirstByte: true
    },
    heartbeatInterval: 30,
    heartbeatTimeout: 90
  },
  metadatas: {
    token: ""
  },
  webServer: {
    addr: "127.0.0.1",
    port: 57400,
    user: "",
    password: "",
    pprofEnable: false
  },
  system: {
    launchAtStartup: false,
    silentStartup: false,
    autoConnectOnStartup: false,
    language: "en-US"
  },
  user: ""
};

export function useConfig() {
  const { t } = useI18n();

  const formData = ref<OpenSourceFrpcDesktopConfiguration>(defaultFormData);
  const loading = ref(1);
  const rules = reactive<FormRules>({
    frpcVersion: [
      {
        required: true,
        message: t("config.form.frpcVerson.requireMessage"),
        trigger: "blur"
      }
    ],
    serverAddr: [
      {
        required: true,
        message: t("config.form.serverAddr.requireMessage"),
        trigger: "blur"
      },
      {
        pattern: /^[\w-]+(\.[\w-]+)+$/,
        message: t("config.form.serverAddr.patternMessage"),
        trigger: "blur"
      }
    ],
    serverPort: [
      {
        required: true,
        message: t("config.form.serverPort.requireMessage"),
        trigger: "blur"
      }
    ],
    user: [
      {
        required: true,
        message: t("config.form.user.requireMessage"),
        trigger: "blur"
      }
    ],
    multiuser: [
      {
        required: true,
        message: t("config.form.multiuser.requireMessage"),
        trigger: "blur"
      }
    ],
    "metadatas.token": [
      {
        required: true,
        message: t("config.form.metadatasToken.requireMessage"),
        trigger: "blur"
      }
    ],
    "auth.method": [
      {
        required: true,
        message: t("config.form.authMethod.requireMessage"),
        trigger: "blur"
      }
    ],
    "auth.token": [
      {
        required: true,
        message: t("config.form.authToken.requireMessage"),
        trigger: "blur"
      }
    ],
    "log.level": [
      {
        required: true,
        message: t("config.form.logLevel.requireMessage"),
        trigger: "blur"
      }
    ],
    "log.maxDays": [
      {
        required: true,
        message: t("config.form.logMaxDays.requireMessage"),
        trigger: "blur"
      }
    ],
    "tls.enable": [
      {
        required: true,
        message: t("config.form.tlsEnable.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.proxyURL": [
      {
        required: false,
        message: t("config.form.proxyURL.requireMessage"),
        trigger: "change"
      },
      {
        pattern: /^https?\:\/\/(\w+:\w+@)?([a-zA-Z0-9.-]+)(:\d+)?$/,
        message: t("config.form.proxyURL.patternMessage"),
        trigger: "blur"
      }
    ],
    "system.launchAtStartup": [
      {
        required: true,
        message: t("config.form.systemLaunchAtStartup.requireMessage"),
        trigger: "change"
      }
    ],
    "system.silentStartup": [
      {
        required: true,
        message: t("config.form.systemSilentStartup.requireMessage"),
        trigger: "change"
      }
    ],
    "system.autoConnectOnStartup": [
      {
        required: true,
        message: t("config.form.systemAutoConnectOnStartup.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.heartbeatInterval": [
      {
        required: true,
        message: t("config.form.heartbeatInterval.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.heartbeatTimeout": [
      {
        required: true,
        message: t("config.form.heartbeatTimeout.requireMessage"),
        trigger: "change"
      }
    ],
    "webServer.port": [
      {
        required: true,
        message: t("config.form.webPort.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.protocol": [
      {
        required: true,
        message: t("config.form.transportProtocol.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.dialServerTimeout": [
      {
        required: true,
        message: t("config.form.dialServerTimeout.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.dialServerKeepalive": [
      {
        required: true,
        message: t("config.form.dialServerKeepalive.requireMessage"),
        trigger: "change"
      }
    ],
    transportPoolCount: [
      {
        required: true,
        message: t("config.form.transportPoolCount.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.tcpMux": [
      {
        required: true,
        message: t("config.form.transportTcpMux.requireMessage"),
        trigger: "change"
      }
    ],
    "transport.tcpMuxKeepaliveInterval": [
      {
        required: true,
        message: t(
          "config.form.transportTcpMuxKeepaliveInterval.requireMessage"
        ),
        trigger: "change"
      }
    ],
    "system.language": [
      {
        required: true,
        message: t("config.form.systemLanguage.requireMessage"),
        trigger: "change"
      }
    ]
  });

  const copyServerConfigBase64 = ref();
  const pasteServerConfigBase64 = ref();
  const formRef = ref<FormInstance>();
  const protocol = ref("frp://");
  const currSelectLocalFileType = ref();
  const frpcDesktopStore = useFrpcDesktopStore();

  const visible = reactive({
    copyServerConfig: false,
    pasteServerConfig: false,
    exportConfig: false
  });

  const checkAndResetVersion = () => {
    const currentVersion = formData.value.frpcVersion;
    if (
      currentVersion &&
      !frpcDesktopStore.downloadedVersions.some(
        item => item.githubReleaseId === currentVersion
      )
    ) {
      formData.value.frpcVersion = null;
    }
  };

  watch(
    () => frpcDesktopStore.downloadedVersions,
    (newValue, oldValue) => {
      checkAndResetVersion();
    }
  );

  const handleSubmit = useDebounceFn(() => {
    if (!formRef.value) return;
    formRef.value.validate(valid => {
      if (valid) {
        loading.value = 1;
        const data = _.cloneDeep(formData.value);
        send(IPCChannels.CONFIG_SAVE_CONFIG, data);
      }
    });
  }, 300);

  const handleMultiuserChange = e => {
    if (e) {
      ElMessageBox.alert(
        t("config.alert.multiuserAlert.message"),
        t("config.alert.multiuserAlert.title"),
        {
          autofocus: false,
          confirmButtonText: t("config.alert.multiuserAlert.confirm"),
          dangerouslyUseHTMLString: true
        }
      );
    }
  };

  const handleLoadSavedConfig = () => {
    send(IPCChannels.CONFIG_GET_SERVER_CONFIG);
  };

  const handleSelectFile = (type: number, ext: string[]) => {
    currSelectLocalFileType.value = type;
    send(IPCChannels.SYSTEM_SELECT_LOCAL_FILE, {
      name: "",
      extensions: ext
    });
  };

  /**
   * 分享配置
   */
  const handleCopyServerConfig2Base64 = useDebounceFn(() => {
    const {
      frpcVersion,
      webServer,
      system,
      log,
      udpPacketSize,
      loginFailExit,
      ...shareConfig
    } = _.cloneDeep(formData.value);
    shareConfig.transport.tls.certFile = "";
    shareConfig.transport.tls.keyFile = "";
    shareConfig.transport.tls.trustedCaFile = "";
    const base64str = Base64.encode(JSON.stringify(shareConfig));
    copyServerConfigBase64.value = protocol.value + base64str;
    visible.copyServerConfig = true;
  }, 300);

  const handlePasteServerConfig4Base64 = useDebounceFn(() => {
    visible.pasteServerConfig = true;
  }, 300);

  const handlePasteServerConfigBase64 = useDebounceFn(() => {
    const tips = () => {
      ElMessage({
        type: "warning",
        message: t("config.message.invalidLink")
      });
    };
    if (!pasteServerConfigBase64.value.startsWith(protocol.value)) {
      tips();
      return;
    }
    const ciphertext = pasteServerConfigBase64.value.replace("frp://", "");
    const plaintext = Base64.decode(ciphertext);
    let serverConfig = null;
    try {
      serverConfig = JSON.parse(plaintext);
    } catch {
      tips();
      return;
    }

    if (!serverConfig && !serverConfig.serverAddr) {
      tips();
      return;
    }
    if (!serverConfig && !serverConfig.serverPort) {
      tips();
      return;
    }
    formData.value.transport =
      serverConfig.transport || defaultFormData.transport;
    formData.value.auth = serverConfig.auth || defaultFormData.auth;
    formData.value.serverAddr =
      serverConfig.serverAddr || defaultFormData.serverAddr;
    formData.value.serverPort =
      serverConfig.serverPort || defaultFormData.serverPort;
    formData.value.metadatas =
      serverConfig.metadatas || defaultFormData.metadatas;
    formData.value.user = serverConfig.user || defaultFormData.user;
    handleSubmit();
    pasteServerConfigBase64.value = "";
    visible.pasteServerConfig = false;
  }, 300);

  const handleShowExportDialog = () => {
    visible.exportConfig = true;
  };

  const handleExportConfig = useDebounceFn(() => {
    send(IPCChannels.CONFIG_EXPORT_CONFIG);
  }, 300);

  const handleImportConfig = () => {
    send(IPCChannels.CONFIG_IMPORT_TOML_CONFIG);
  };

  const handleResetConfig = () => {
    ElMessageBox.alert(
      t("config.alert.resetConfig.message"),
      t("config.alert.resetConfig.title"),
      {
        showCancelButton: true,
        cancelButtonText: t("config.alert.resetConfig.cancel"),
        confirmButtonText: t("config.alert.resetConfig.confirm")
      }
    ).then(() => {
      send(IPCChannels.CONFIG_RESET_ALL_CONFIG);
    });
  };

  const handleOpenDataFolder = useDebounceFn(() => {
    send(IPCChannels.SYSTEM_OPEN_APP_DATA);
  }, 300);

  const handleSystemLanguageChange = e => {
    send(IPCChannels.CONFIG_SAVE_LANGUAGE, {
      language: e
    });
  };

  onMounted(() => {
    handleLoadSavedConfig();

    on(IPCChannels.CONFIG_GET_SERVER_CONFIG, data => {
      if (data) {
        formData.value = data;
        Object.keys(defaultFormData).forEach(key => {
          if (!formData.value[key]) {
            formData.value[key] = defaultFormData[key];
          }
        });
        checkAndResetVersion();
      }
      loading.value--;
    });

    on(IPCChannels.CONFIG_SAVE_CONFIG, data => {
      ElMessage({
        type: "success",
        message: t("config.message.saveSuccess")
      });
      loading.value--;
      frpcDesktopStore.getLanguage();
    });

    on(IPCChannels.SYSTEM_SELECT_LOCAL_FILE, data => {
      if (!data.canceled) {
        switch (currSelectLocalFileType.value) {
          case 1:
            formData.value.transport.tls.certFile = data.path as string;
            break;
          case 2:
            formData.value.transport.tls.keyFile = data.path as string;
            break;
          case 3:
            formData.value.transport.tls.trustedCaFile = data.path as string;
            break;
        }
      }
    });

    on(IPCChannels.CONFIG_RESET_ALL_CONFIG, () => {
      ElMessageBox.alert(
        t("config.alert.resetConfigSuccess.message"),
        t("config.alert.resetConfigSuccess.title"),
        {
          closeOnClickModal: false,
          showClose: false,
          confirmButtonText: t("config.alert.resetConfigSuccess.confirm")
        }
      ).then(() => {
        send(IPCChannels.SYSTEM_RELAUNCH_APP);
      });
    });

    on(IPCChannels.CONFIG_IMPORT_TOML_CONFIG, data => {
      const { canceled, path } = data;
      if (!canceled) {
        // 礼花
        confetti({
          zIndex: 12002,
          particleCount: 200,
          spread: 70,
          origin: { y: 0.6 }
        });
        ElMessageBox.alert(
          t("config.alert.importTomlConfigSuccess.message"),
          t("config.alert.importTomlConfigSuccess.title"),
          {
            closeOnClickModal: false,
            showClose: false,
            confirmButtonText: t("config.alert.importTomlConfigSuccess.confirm")
          }
        ).then(() => {
          send(IPCChannels.SYSTEM_RELAUNCH_APP);
        });
      }
    });

    on(IPCChannels.CONFIG_EXPORT_CONFIG, data => {
      const { canceled, path } = data;
      if (!canceled) {
        ElMessageBox.alert(
          t("config.alert.exportConfigSuccess.message", { path }),
          t("config.alert.exportConfigSuccess.title")
        );
      }
    });

    on(IPCChannels.SYSTEM_OPEN_APP_DATA, () => {
      ElMessage({
        type: "success",
        message: t("config.message.openAppDataSuccess")
      });
    });

    on(IPCChannels.CONFIG_SAVE_LANGUAGE, data => {
      ElMessage({
        type: "success",
        message: t("config.message.saveSuccess")
      });
      loading.value--;
      frpcDesktopStore.getLanguage();
    });
  });

  onUnmounted(() => {
    removeRouterListeners(IPCChannels.CONFIG_SAVE_CONFIG);
    removeRouterListeners(IPCChannels.CONFIG_GET_SERVER_CONFIG);
    removeRouterListeners(IPCChannels.CONFIG_RESET_ALL_CONFIG);
    removeRouterListeners(IPCChannels.CONFIG_IMPORT_TOML_CONFIG);
    removeRouterListeners(IPCChannels.CONFIG_EXPORT_CONFIG);
    removeRouterListeners(IPCChannels.SYSTEM_OPEN_APP_DATA);
    removeRouterListeners(IPCChannels.SYSTEM_SELECT_LOCAL_FILE);
    removeRouterListeners(IPCChannels.SYSTEM_RELAUNCH_APP);
  });

  return {
    t,
    formData,
    loading,
    rules,
    copyServerConfigBase64,
    pasteServerConfigBase64,
    formRef,
    protocol,
    currSelectLocalFileType,
    frpcDesktopStore,
    visible,
    handleSubmit,
    handleMultiuserChange,
    handleSelectFile,
    handleCopyServerConfig2Base64,
    handlePasteServerConfig4Base64,
    handlePasteServerConfigBase64,
    handleShowExportDialog,
    handleExportConfig,
    handleImportConfig,
    handleResetConfig,
    handleOpenDataFolder,
    handleSystemLanguageChange
  };
}
