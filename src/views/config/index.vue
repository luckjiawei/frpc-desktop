<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import confetti from "canvas-confetti/src/confetti.js";
import { ElMessage, ElMessageBox, FormInstance, FormRules } from "element-plus";
import { Base64 } from "js-base64";
import _ from "lodash";
import {
  defineComponent,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";

defineComponent({
  name: "Config"
});

// type ShareLinkConfig = {
//   serverAddr: string;
//   serverPort: number;
//   authMethod: string;
//   authToken: string;
//   transportHeartbeatInterval: number;
//   transportHeartbeatTimeout: number;
//   user: string;
//   metaToken: string;
// };

const { t } = useI18n();

const defaultFormData: OpenSourceFrpcDesktopServer = {
  _id: "",
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
    language: "zh-CN"
  },
  user: ""
};
const formData = ref<OpenSourceFrpcDesktopServer>(defaultFormData);
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
  // tlsConfigCertFile: [
  //   { required: true, message: "请选择 TLS 证书文件", trigger: "change" }
  // ],
  // tlsConfigKeyFile: [
  //   { required: true, message: "请选择 TLS 密钥文件", trigger: "change" }
  // ],
  // tlsConfigTrustedCaFile: [
  //   { required: true, message: "请选择 CA 证书文件", trigger: "change" }
  // ],
  // tlsConfigServerName: [
  //   { required: true, message: "请输入 TLS Server 名称", trigger: "blur" }
  // ],
  // proxyConfigEnable: [
  //   { required: true, message: "请选择代理状态", trigger: "change" }
  // ],
  "transport.proxyURL": [
    {
      required: true,
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
  // webEnable: [
  //   { required: true, message: "web界面开关不能为空", trigger: "change" }
  // ],
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
      message: t("config.form.transportTcpMuxKeepaliveInterval.requireMessage"),
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

watch(
  () => frpcDesktopStore.downloadedVersions,
  (newValue, oldValue) => {
    checkAndResetVersion();
  }
);

const visible = reactive({
  copyServerConfig: false,
  pasteServerConfig: false,
  exportConfig: false
});

// const exportConfigType = ref("toml");

const handleSubmit = useDebounceFn(() => {
  if (!formRef.value) return;
  formRef.value.validate(valid => {
    if (valid) {
      loading.value = 1;
      const data = _.cloneDeep(formData.value);
      send(ipcRouters.SERVER.saveConfig, data);
    }
  });
}, 300);

const handleMultiuserChange = e => {
  if (e) {
    ElMessageBox.alert(
      t("config.alert.multiuserAlert.message"),
      t("config.alert.multiuserAlert.title"),
      {
        // if you want to disable its autofocus
        autofocus: false,
        confirmButtonText: t("config.alert.multiuserAlert.confirm"),
        dangerouslyUseHTMLString: true
      }
    );
  }
};

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

// const handleLoadDownloadedVersion = () => {
//   send(ipcRouters.VERSION.getDownloadedVersions);
// };

const handleLoadSavedConfig = () => {
  send(ipcRouters.SERVER.getServerConfig);
};

onMounted(() => {
  // handleLoadDownloadedVersion();
  handleLoadSavedConfig();

  on(ipcRouters.SERVER.getServerConfig, data => {
    console.log("data", data);
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

  // on(ipcRouters.VERSION.getDownloadedVersions, data => {
  //   // versions.value = data;
  //   checkAndResetVersion();
  // });

  on(ipcRouters.SERVER.saveConfig, data => {
    ElMessage({
      type: "success",
      message: t("config.message.saveSuccess")
    });
    loading.value--;
  });

  on(ipcRouters.SYSTEM.selectLocalFile, data => {
    console.log("data", data);
    if (!data.canceled) {
      switch (currSelectLocalFileType.value) {
        case 1:
          formData.value.transport.tls.certFile = data.path as string;
          // tlsConfigCertFile = data;
          break;
        case 2:
          formData.value.transport.tls.keyFile = data.path as string;
          break;
        case 3:
          formData.value.transport.tls.trustedCaFile = data.path as string;
          // formData.value.tlsConfigTrustedCaFile = data as string;
          break;
      }
    }
  });

  on(ipcRouters.SERVER.resetAllConfig, () => {
    ElMessageBox.alert(
      t("config.alert.resetConfigSuccess.message"),
      t("config.alert.resetConfigSuccess.title"),
      {
        closeOnClickModal: false,
        showClose: false,
        confirmButtonText: t("config.alert.resetConfigSuccess.confirm")
      }
    ).then(() => {
      send(ipcRouters.SYSTEM.relaunchApp);
    });
  });

  on(ipcRouters.SERVER.importTomlConfig, data => {
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
        send(ipcRouters.SYSTEM.relaunchApp);
      });
    }
  });

  on(ipcRouters.SERVER.exportConfig, data => {
    const { canceled, path } = data;
    if (!canceled) {
      ElMessageBox.alert(
        t("config.alert.exportConfigSuccess.message", { path }),
        t("config.alert.exportConfigSuccess.title")
      );
    }
  });
  // ElMessageBox.alert(data, `提示`);
  on(ipcRouters.SYSTEM.openAppData, () => {
    ElMessage({
      type: "success",
      message: t("config.message.openAppDataSuccess")
    });
  });
});

const handleSelectFile = (type: number, ext: string[]) => {
  currSelectLocalFileType.value = type;
  send(ipcRouters.SYSTEM.selectLocalFile, {
    name: "",
    extensions: ext
  });
};

/**
 * 分享配置
 */
const handleCopyServerConfig2Base64 = useDebounceFn(() => {
  const {
    _id,
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
  send(ipcRouters.SERVER.exportConfig);
  // visibles.exportConfig = false;
}, 300);

const handleImportConfig = () => {
  send(ipcRouters.SERVER.importTomlConfig);
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
    send(ipcRouters.SERVER.resetAllConfig);
  });
};

const handleOpenDataFolder = useDebounceFn(() => {
  send(ipcRouters.SYSTEM.openAppData);
}, 300);

onUnmounted(() => {
  removeRouterListeners(ipcRouters.SERVER.saveConfig);
  removeRouterListeners(ipcRouters.SERVER.getServerConfig);
  removeRouterListeners(ipcRouters.SERVER.resetAllConfig);
  removeRouterListeners(ipcRouters.SERVER.importTomlConfig);
  removeRouterListeners(ipcRouters.SERVER.exportConfig);
  removeRouterListeners(ipcRouters.SYSTEM.openAppData);
  removeRouterListeners(ipcRouters.SYSTEM.selectLocalFile);
  removeRouterListeners(ipcRouters.SYSTEM.relaunchApp);
});
</script>
<template>
  <div class="main">
    <breadcrumb>
      <el-button plain type="primary" @click="handleOpenDataFolder">
        <IconifyIconOffline icon="folder-rounded" />
      </el-button>
      <el-button plain type="primary" @click="handleResetConfig">
        <IconifyIconOffline icon="deviceReset" />
      </el-button>
      <el-button plain type="primary" @click="handleImportConfig">
        <IconifyIconOffline icon="file-open-rounded" />
      </el-button>
      <el-button plain type="primary" @click="handleExportConfig">
        <IconifyIconOffline icon="file-save-rounded" />
      </el-button>
      <el-button type="primary" @click="handleSubmit">
        <IconifyIconOffline icon="save-rounded" />
      </el-button>
    </breadcrumb>
    <div class="pr-2 app-container-breadcrumb" v-loading="loading > 0">
      <div class="w-full p-4 bg-white rounded drop-shadow-lg">
        <el-form
          :model="formData"
          :rules="rules"
          label-position="right"
          ref="formRef"
          label-width="150"
        >
          <el-row :gutter="10">
            <el-col :span="24">
              <div class="flex justify-between h2">
                <div>{{ t("config.title.versionSelection") }}</div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.frpcVerson.label')"
                prop="frpcVersion"
              >
                <el-select
                  v-model="formData.frpcVersion"
                  class="w-full"
                  clearable
                >
                  <el-option
                    v-for="v in frpcDesktopStore.downloadedVersions"
                    :key="v.githubReleaseId"
                    :label="v.name"
                    :value="v.githubReleaseId"
                  />
                </el-select>
                <div class="flex justify-end w-full">
                  <el-link
                    type="primary"
                    @click="frpcDesktopStore.refreshDownloadedVersion()"
                  >
                    <iconify-icon-offline class="mr-1" icon="refresh-rounded" />
                    {{ t("config.button.manualRefresh") }}
                  </el-link>
                  <el-link
                    class="ml-2"
                    type="primary"
                    @click="$router.replace({ name: 'Download' })"
                  >
                    <IconifyIconOffline class="mr-1" icon="download" />
                    {{ t("config.button.goToDownload") }}
                  </el-link>
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="flex justify-between h2">
                <div>{{ t("config.title.serverConfiguration") }}</div>
                <div class="flex items-center justify-center">
                  <IconifyIconOffline
                    @click="handleCopyServerConfig2Base64"
                    class="mr-2 text-xl font-bold cursor-pointer"
                    icon="content-copy"
                  />
                  <IconifyIconOffline
                    @click="handlePasteServerConfig4Base64"
                    class="mr-2 text-xl font-bold cursor-pointer"
                    icon="content-paste-go"
                  />
                </div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.serverAddr.label')"
                prop="serverAddr"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default>
                        Frps服务端地址 <br />
                        支持
                        <span class="font-black text-[#5A3DAA]">域名</span
                        >、<span class="font-black text-[#5A3DAA]">IP</span>
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.serverAddr.label") }}
                </template>
                <el-input
                  v-model="formData.serverAddr"
                  placeholder="127.0.0.1"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.serverPort.label')"
                prop="serverPort"
              >
                <el-input-number
                  placeholder="7000"
                  v-model="formData.serverPort"
                  :min="0"
                  :max="65535"
                  controls-position="right"
                  class="!w-full"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.authMethod.label')"
                prop="auth.method"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="200" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:
                        <span class="font-black text-[#5A3DAA]"
                          >auth.method</span
                        >
                      </template>
                      <template #reference>
                        <!--                        <IconifyIconOffline class="text-base" color="#5A3DAA" icon="info"/>-->
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.authMethod.label") }}
                </template>
                <el-select
                  v-model="formData.auth.method"
                  placeholder="请选择验证方式"
                  clearable
                >
                  <el-option label="无" value="none"></el-option>
                  <el-option label="令牌（token）" value="token"></el-option>
                  <!--                  <el-option label="多用户" value="multiuser"></el-option>-->
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24" v-if="formData.auth.method === 'token'">
              <el-form-item
                :label="t('config.form.authToken.label')"
                prop="authToken"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover" width="200">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >auth.token</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.authToken.label") }}
                </template>
                <el-input
                  placeholder="token"
                  type="password"
                  v-model="formData.auth.token"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.multiuser.label')"
                prop="multiuser"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default> 是否开启多用户模式 </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.multiuser.label") }}
                </template>
                <el-switch
                  @change="handleMultiuserChange"
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.multiuser"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.multiuser">
              <el-form-item :label="t('config.form.user.label')" prop="user">
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >user</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.user.label") }}
                </template>
                <el-input placeholder="请输入用户" v-model="formData.user" />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.multiuser">
              <el-form-item
                :label="t('config.form.metadatasToken.label')"
                prop="metadatas.token"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="200" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >metadatas.token</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.metadatasToken.label") }}
                </template>
                <el-input
                  placeholder="请输入用户令牌"
                  type="password"
                  v-model="formData.metadatas.token"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
            <!-- <el-col :span="24">
              <div class="h2">TLS Config</div>
            </el-col> -->

            <el-col :span="24">
              <div class="h2">
                {{ t("config.title.transportConfiguration") }}
              </div>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportProtocol.label')"
                prop="transport.protocol"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        和 frps 之间的通信协议。默认为 tcp。<br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.protocol</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportProtocol.label") }}
                </template>
                <el-select v-model="formData.transport.protocol">
                  <el-option label="tcp" value="tcp" />
                  <el-option label="kcp" value="kcp" />
                  <el-option label="quic" value="quic" />
                  <el-option label="websocket" value="websocket" />
                  <el-option label="wss" value="wss" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportPoolCount.label')"
                prop="transport.poolCount"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.poolCount</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportPoolCount.label") }}
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.poolCount"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportHeartbeatInterval.label')"
                prop="transport.heartbeatInterval"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        多长向服务端发发送一次心跳包 单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.heartbeatInterval</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportHeartbeatInterval.label") }}
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.heartbeatInterval"
                  :min="1"
                  :max="600"
                  controls-position="right"
                />
                <!--                <el-input-->
                <!--                    placeholder="请输入心跳间隔"-->
                <!--                    type="number"-->
                <!--                    :min="0"-->
                <!--                    v-model="formData.heartbeatInterval"-->
                <!--                >-->
                <!--                  <template #append>秒</template>-->
                <!--                </el-input>-->
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportHeartbeatTimeout.label')"
                prop="transport.heartbeatTimeout"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        心跳超时时间 单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.heartbeatTimeout</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportHeartbeatTimeout.label") }}
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.heartbeatTimeout"
                  :min="1"
                  :max="600"
                  controls-position="right"
                />
                <!--                <el-input-->
                <!--                    placeholder="请输入心跳超时时间"-->
                <!--                    :min="0"-->
                <!--                    type="number"-->
                <!--                    v-model="formData.heartbeatTimeout"-->
                <!--                >-->
                <!--                  <template #append>秒</template>-->
                <!--                </el-input>-->
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportDialServerTimeout.label')"
                prop="transport.dialServerTimeout"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        与服务器建立连接的最长等待时间。默认值为10秒。单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.dialServerTimeout</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportDialServerTimeout.label") }}
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.dialServerTimeout"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportDialServerKeepalive.label')"
                prop="transport.dialServerKeepalive"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        客户端与服务端之间的连接在一定时间内没有任何数据传输，系统会定期发送一些心跳数据包来保持连接的活跃状态。如果为负，则禁用保活探测。
                        单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.dialServerKeepalive</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportDialServerKeepalive.label") }}
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.dialServerKeepalive"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>

            <el-col :span="12">
              <el-form-item
                :label="t('config.form.transportTcpMux.label')"
                prop="transport.tcpMux"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        TCP 多路复用，默认启用。<br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.tcpMux</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportTcpMux.label") }}
                </template>
                <el-switch
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.transport.tcpMux"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.transport.tcpMux">
              <el-form-item
                :label="t('config.form.transportTcpMuxKeepaliveInterval.label')"
                prop="transport.tcpMuxKeepaliveInterval"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        多路复用的保活间隔，默认值为 30 秒。单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.tcpMuxKeepaliveInterval</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportTcpMuxKeepaliveInterval.label") }}
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.tcpMuxKeepaliveInterval"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <!--            <el-col :span="24">-->
            <!--              <el-form-item label="启用代理：" prop="proxyConfigEnable">-->
            <!--                <el-switch-->
            <!--                  active-text="开"-->
            <!--                  inline-prompt-->
            <!--                  inactive-text="关"-->
            <!--                  v-model="formData.proxyConfigEnable"-->
            <!--                />-->
            <!--              </el-form-item>-->
            <!--            </el-col>-->
            <!--            <template v-if="formData.proxyConfigEnable">-->
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.transportProxyURL.label')"
                prop="transport.proxyURL"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >transport.proxyURL</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.transportProxyURL.label") }}
                </template>
                <el-input
                  v-model="formData.transport.proxyURL"
                  placeholder="http://user:pwd@192.168.1.128:8080"
                />
              </el-form-item>
            </el-col>
            <!--            </template>-->
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.tlsEnable.label')"
                prop="transport.tls.enable"
              >
                <el-switch
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.transport.tls.enable"
                />
              </el-form-item>
            </el-col>
            <template v-if="formData.transport.tls.enable">
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.tlsCertFile.label')"
                  prop="tlsConfigCertFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center h-full mr-1">
                      <el-popover width="260" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.certFile</span
                          >
                        </template>
                        <template #reference>
                          <IconifyIconOffline
                            class="text-base"
                            color="#5A3DAA"
                            icon="info"
                          />
                        </template>
                      </el-popover>
                    </div>
                    {{ t("config.form.tlsCertFile.label") }}
                  </template>
                  <el-input
                    class="button-input !cursor-pointer"
                    v-model="formData.transport.tls.certFile"
                    placeholder="点击选择TLS证书文件"
                    readonly
                    clearable
                    @click="handleSelectFile(1, ['crt'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(1, ['crt'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="formData.transport.tls.certFile"
                    class="ml-2"
                    type="danger"
                    @click="formData.transport.tls.certFile = ''"
                    >{{ t("config.button.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.tlsKeyFile.label')"
                  prop="transport.tls.keyFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center h-full mr-1">
                      <el-popover width="260" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.keyFile</span
                          >
                        </template>
                        <template #reference>
                          <IconifyIconOffline
                            class="text-base"
                            color="#5A3DAA"
                            icon="info"
                          />
                        </template>
                      </el-popover>
                    </div>
                    {{ t("config.form.tlsKeyFile.label") }}
                  </template>
                  <el-input
                    class="button-input"
                    v-model="formData.transport.tls.keyFile"
                    placeholder="点击选择 TLS 密钥文件"
                    readonly
                    @click="handleSelectFile(2, ['key'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(2, ['key'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="formData.transport.tls.keyFile"
                    class="ml-2"
                    type="danger"
                    @click="formData.transport.tls.keyFile = ''"
                    >{{ t("config.button.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.caCertFile.label')"
                  prop="transport.tls.trustedCaFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center h-full mr-1">
                      <el-popover width="310" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.trustedCaFile</span
                          >
                        </template>
                        <template #reference>
                          <IconifyIconOffline
                            class="text-base"
                            color="#5A3DAA"
                            icon="info"
                          />
                        </template>
                      </el-popover>
                    </div>
                    {{ t("config.form.caCertFile.label") }}
                  </template>
                  <el-input
                    class="button-input"
                    v-model="formData.transport.tls.trustedCaFile"
                    placeholder="点击选择 CA 证书文件"
                    readonly
                    @click="handleSelectFile(3, ['crt'])"
                  />
                  <!--                  <el-button-->
                  <!--                    class="ml-2"-->
                  <!--                    type="primary"-->
                  <!--                    @click="handleSelectFile(3, ['crt'])"-->
                  <!--                    >选择-->
                  <!--                  </el-button>-->
                  <el-button
                    v-if="formData.transport.tls.trustedCaFile"
                    class="ml-2"
                    type="danger"
                    @click="formData.transport.tls.trustedCaFile = ''"
                    >{{ t("config.button.clear") }}
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  :label="t('config.form.tlsServerName.label')"
                  prop="tlsConfigServerName"
                  label-width="180"
                >
                  <template #label>
                    <div class="flex items-center h-full mr-1">
                      <el-popover width="300" placement="top" trigger="hover">
                        <template #default>
                          {{ t("config.popover.frpParameter") }}:<span
                            class="font-black text-[#5A3DAA]"
                            >transport.tls.serverName</span
                          >
                        </template>
                        <template #reference>
                          <IconifyIconOffline
                            class="text-base"
                            color="#5A3DAA"
                            icon="info"
                          />
                        </template>
                      </el-popover>
                    </div>
                    {{ t("config.form.tlsServerName.label") }}
                  </template>
                  <el-input
                    v-model="formData.transport.tls.serverName"
                    placeholder="请输入TLS Server 名称"
                    clearable
                  />
                </el-form-item>
              </el-col>
            </template>

            <el-col :span="24">
              <div class="h2">{{ t("config.title.webInterface") }}</div>
            </el-col>

            <!--            <el-col :span="12">-->
            <!--              <el-form-item label="启用Web界面：" prop="webEnable">-->
            <!--                <template #label>-->
            <!--                  <div class="flex items-center h-full mr-1">-->
            <!--                    <el-popover width="300" placement="top" trigger="hover">-->
            <!--                      <template #reference>-->
            <!--                        <IconifyIconOffline-->
            <!--                          class="text-base"-->
            <!--                          color="#5A3DAA"-->
            <!--                          icon="info"-->
            <!--                        />-->
            <!--                      </template>-->
            <!--                      热更新等功能依赖于web界面，<span-->
            <!--                        class="font-black text-[#5A3DAA]"-->
            <!--                        >不可停用Web</span-->
            <!--                      >-->
            <!--                    </el-popover>-->
            <!--                  </div>-->
            <!--                  启用Web：-->
            <!--                </template>-->
            <!--                <el-switch-->
            <!--                  active-text="开"-->
            <!--                  inline-prompt-->
            <!--                  disabled-->
            <!--                  inactive-text="关"-->
            <!--                  v-model="formData.webServer."-->
            <!--                />-->
            <!--              </el-form-item>-->
            <!--            </el-col>-->

            <!--            <template v-if="formData.webEnable">-->
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.webServerPort.label')"
                prop="webPort"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        {{ t("config.popover.frpParameter") }}:<span
                          class="font-black text-[#5A3DAA]"
                          >webServer.port</span
                        ><br />
                        自行保证端口没有被占用，否则会导致启动失败
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.webServerPort.label") }}
                </template>
                <el-input-number
                  placeholder="57400"
                  v-model="formData.webServer.port"
                  :min="0"
                  :max="65535"
                  controls-position="right"
                  class="w-full"
                ></el-input-number>
              </el-form-item>
            </el-col>
            <!--            </template>-->

            <el-col :span="24">
              <div class="h2">{{ t("config.title.logConfiguration") }}</div>
            </el-col>
            <el-col :span="12">
              <el-form-item
                class="!w-full"
                :label="t('config.form.logLevel.label')"
                prop="log.level"
              >
                <el-select v-model="formData.log.level">
                  <el-option label="info" value="info" />
                  <el-option label="debug" value="debug" />
                  <el-option label="warn" value="warn" />
                  <el-option label="error" value="error" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item
                :label="t('config.form.logMaxDays.label')"
                prop="log.maxDays"
              >
                <el-input-number
                  class="!w-full"
                  controls-position="right"
                  v-model="formData.log.maxDays"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2">{{ t("config.title.systemConfiguration") }}</div>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('config.form.systemLaunchAtStartup.label')"
                prop="system.launchAtStartup"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default>
                        开机自动启动 <br /><span
                          class="font-black text-[#5A3DAA]"
                          >Frpc Desktop</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.systemLaunchAtStartup.label") }}
                </template>
                <el-switch
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.system.launchAtStartup"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('config.form.systemSilentStartup.label')"
                prop="system.silentStartup"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default>
                        开启后启动时<span class="font-black text-[#5A3DAA]"
                          >不打开界面</span
                        >
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.systemSilentStartup.label") }}
                </template>
                <el-switch
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.system.silentStartup"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item
                :label="t('config.form.systemAutoConnectOnStartup.label')"
                prop="system.autoConnectOnStartup"
              >
                <template #label>
                  <div class="flex items-center h-full mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default>
                        启动软件后是否<span class="font-black text-[#5A3DAA]"
                          >自动连接</span
                        >服务器
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="#5A3DAA"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.systemAutoConnectOnStartup.label") }}
                </template>
                <el-switch
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.system.autoConnectOnStartup"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.systemLanguage.label')"
                prop="system.language"
              >
                <el-select v-model="formData.system.language">
                  <el-option label="中文" value="zh-CN" />
                  <el-option label="en-US" value="en-US" />
                </el-select>
              </el-form-item>
            </el-col>
            <!--            <el-col :span="24">-->
            <!--              <el-form-item>-->
            <!--                <el-button plain type="primary" @click="handleSubmit">-->
            <!--                  <IconifyIconOffline icon="save" />-->
            <!--                  保 存-->
            <!--                </el-button>-->
            <!--              </el-form-item>-->
            <!--            </el-col>-->
          </el-row>
        </el-form>
      </div>
    </div>
    <!--  链接导入服务器  -->
    <el-dialog
      v-model="visible.copyServerConfig"
      :title="t('config.dialog.copyLink.title')"
      width="500"
      top="5%"
    >
      <el-alert
        class="mb-4"
        :title="t('config.dialog.copyLink.warning.message')"
        type="warning"
        :closable="false"
      />
      <el-input
        class="h-30"
        v-model="copyServerConfigBase64"
        type="textarea"
        :rows="8"
      ></el-input>
    </el-dialog>
    <!--    链接导出服务器-->
    <el-dialog
      v-model="visible.pasteServerConfig"
      :title="t('config.dialog.importLink.title')"
      width="500"
      top="5%"
    >
      <el-input
        class="h-30"
        v-model="pasteServerConfigBase64"
        type="textarea"
        placeholder="frp://......"
        :rows="8"
      ></el-input>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            plain
            type="primary"
            @click="handlePasteServerConfigBase64"
          >
            <IconifyIconOffline
              class="mr-2 cursor-pointer"
              icon="label-important-rounded"
            />
            {{ t("config.button.import") }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <!--    配置导出-->
    <!--    <el-dialog-->
    <!--      v-model="visibles.exportConfig"-->
    <!--      title="导出配置"-->
    <!--      width="500"-->
    <!--      top="5%"-->
    <!--    >-->
    <!--      <el-alert-->
    <!--        class="mb-4"-->
    <!--        :title="`导出文件名为 frpc-desktop.${exportConfigType} 重复导出则覆盖`"-->
    <!--        type="warning"-->
    <!--        :closable="false"-->
    <!--      />-->
    <!--      <el-form>-->
    <!--        <el-form-item label="导出类型">-->
    <!--          <el-radio-group v-model="exportConfigType">-->
    <!--            <el-radio-button label="toml" value="toml" />-->
    <!--            <el-radio-button label="ini" value="ini" />-->
    <!--          </el-radio-group>-->
    <!--        </el-form-item>-->
    <!--      </el-form>-->
    <!--      <template #footer>-->
    <!--        <div class="dialog-footer">-->
    <!--          <el-button plain type="primary" @click="handleExportConfig">-->
    <!--            <IconifyIconOffline-->
    <!--              class="mr-2 cursor-pointer"-->
    <!--              icon="downloadRounded"-->
    <!--            />-->
    <!--            导 出-->
    <!--          </el-button>-->
    <!--        </div>-->
    <!--      </template>-->
    <!--    </el-dialog>-->
  </div>
</template>

<style lang="scss" scoped>
.button-input {
  width: calc(100% - 68px);
}
</style>
