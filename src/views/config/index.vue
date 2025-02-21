<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, reactive, ref } from "vue";
import { ipcRenderer } from "electron";
import { ElMessage, ElMessageBox, FormInstance, FormRules } from "element-plus";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useDebounceFn } from "@vueuse/core";
import { clone } from "@/utils/clone";
import { Base64 } from "js-base64";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { on, send } from "@/utils/ipcUtils";
import { ipcRouters } from "../../../electron/core/IpcRouter";

defineComponent({
  name: "Config"
});

type ShareLinkConfig = {
  serverAddr: string;
  serverPort: number;
  authMethod: string;
  authToken: string;
  transportHeartbeatInterval: number;
  transportHeartbeatTimeout: number;
  user: string;
  metaToken: string;
};

const defaultFormData = ref<OpenSourceFrpcDesktopServer>({
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
      enable: false,
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
    autoConnectOnStartup: false
  },
  user: ""
});

const formData = ref<OpenSourceFrpcDesktopServer>(defaultFormData.value);

const loading = ref(1);

const rules = reactive<FormRules>({
  frpcVersion: [{ required: true, message: "请选择版本", trigger: "blur" }],
  serverAddr: [
    { required: true, message: "请输入服务端地址", trigger: "blur" },
    {
      pattern: /^[\w-]+(\.[\w-]+)+$/,
      message: "请输入正确的服务端地址",
      trigger: "blur"
    }
  ],
  serverPort: [
    { required: true, message: "请输入服务器端口", trigger: "blur" }
  ],
  user: [{ required: true, message: "请输入用户", trigger: "blur" }],
  "metadatas.token": [
    { required: true, message: "请输入多用户令牌", trigger: "blur" }
  ],
  "auth.method": [
    { required: true, message: "请选择验证方式", trigger: "blur" }
  ],
  "auth.token": [
    { required: true, message: "请输入 Token 值 ", trigger: "blur" }
  ],
  "log.level": [
    { required: true, message: "请选择日志级别 ", trigger: "blur" }
  ],
  "log.maxDays": [
    { required: true, message: "请输入日志保留天数 ", trigger: "blur" }
  ],
  "tls.enable": [
    { required: true, message: "请选择 TLS 状态", trigger: "change" }
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
    { required: true, message: "请输入代理地址", trigger: "change" },
    {
      pattern: /^https?\:\/\/(\w+:\w+@)?([a-zA-Z0-9.-]+)(:\d+)?$/,
      message: "请输入正确的代理地址",
      trigger: "blur"
    }
  ],
  "system.launchAtStartup": [
    { required: true, message: "请选择是否开机自启", trigger: "change" }
  ],
  "system.silentStartup": [
    { required: true, message: "请选择是否开启静默启动", trigger: "change" }
  ],
  "system.autoConnectOnStartup": [
    { required: true, message: "请选择是否开启自动连接", trigger: "change" }
  ],
  "transport.heartbeatInterval": [
    { required: true, message: "心跳间隔时间不能为空", trigger: "change" }
  ],
  "transport.heartbeatTimeout": [
    { required: true, message: "心跳超时时间不能为空", trigger: "change" }
  ],
  // webEnable: [
  //   { required: true, message: "web界面开关不能为空", trigger: "change" }
  // ],
  "webServer.port": [
    { required: true, message: "web界面端口不能为空", trigger: "change" }
  ],
  "transport.protocol": [
    { required: true, message: "传输协议不能为空", trigger: "change" }
  ],
  "transport.dialServerTimeout": [
    { required: true, message: "web界面端口不能为空", trigger: "change" }
  ],
  "transport.dialServerKeepalive": [
    { required: true, message: "web界面端口不能为空", trigger: "change" }
  ],
  transportPoolCount: [
    { required: true, message: "web界面端口不能为空", trigger: "change" }
  ],
  "transport.tcpMux": [
    { required: true, message: "web界面端口不能为空", trigger: "change" }
  ],
  "transport.tcpMuxKeepaliveInterval": [
    { required: true, message: "web界面端口不能为空", trigger: "change" }
  ]
});

const versions = ref<Array<FrpVersion>>([]);
const copyServerConfigBase64 = ref();
const pasteServerConfigBase64 = ref();

const formRef = ref<FormInstance>();
const protocol = ref("frp://");

const visibles = reactive({
  copyServerConfig: false,
  pasteServerConfig: false,
  exportConfig: false
});

const exportConfigType = ref("toml");

const handleSubmit = useDebounceFn(() => {
  if (!formRef.value) return;
  formRef.value.validate(valid => {
    if (valid) {
      loading.value = 1;
      const data = clone(formData.value);
      ipcRenderer.send("server/saveConfig", data);
    }
  });
}, 300);

const handleLoadVersions = () => {
  ipcRenderer.send("config.versions");
};

const handleAuthMethodChange = e => {
  if (e === "multiuser") {
    ElMessageBox.alert(
      '多用户插件需要 Frp版本 >= <span class="font-black text-[#5A3DAA]">v0.31.0</span> 请自行选择正确版本',
      "提示",
      {
        // if you want to disable its autofocus
        autofocus: false,
        confirmButtonText: "知道了",
        dangerouslyUseHTMLString: true
      }
    );
  }
};

const checkAndResetVersion = () => {
  const currentVersion = formData.value.currentVersion;
  if (
    currentVersion &&
    !versions.value.some(item => item.id === currentVersion)
  ) {
    formData.value.currentVersion = null;
  }
};

onMounted(() => {
  send(ipcRouters.SERVER.getServerConfig);

  on(ipcRouters.SERVER.getServerConfig, data => {
    console.log("data", data);
    loading.value--;
  });
  // ipcRenderer.send("config.getConfig");
  // handleLoadVersions();
  // ipcRenderer.on("Config.getConfig.hook", (event, args) => {
  //   const { err, data } = args;
  //   if (!err) {
  //     if (data) {
  //       console.log("data", data);
  //
  //       if (!data.transportHeartbeatInterval) {
  //         data.transportHeartbeatInterval =
  //           defaultFormData.value.transportHeartbeatInterval;
  //       }
  //       if (!data.transportHeartbeatTimeout) {
  //         data.transportHeartbeatTimeout =
  //           defaultFormData.value.transportHeartbeatTimeout;
  //       }
  //       if (data.webEnable == null || data.webEnable == undefined) {
  //         data.webEnable = defaultFormData.value.webEnable;
  //         data.webPort = defaultFormData.value.webPort;
  //       }
  //       if (
  //         data.transportProtocol === undefined ||
  //         data.transportProtocol == null
  //       ) {
  //         data.transportProtocol = defaultFormData.value.transportProtocol;
  //       }
  //       if (
  //         data.transportDialServerTimeout === undefined ||
  //         data.transportDialServerTimeout == null
  //       ) {
  //         data.transportDialServerTimeout =
  //           defaultFormData.value.transportDialServerTimeout;
  //       }
  //       if (
  //         data.transportDialServerKeepalive === undefined ||
  //         data.transportDialServerKeepalive == null
  //       ) {
  //         data.transportDialServerKeepalive =
  //           defaultFormData.value.transportDialServerKeepalive;
  //       }
  //       if (
  //         data.transportPoolCount === undefined ||
  //         data.transportPoolCount == null
  //       ) {
  //         data.transportPoolCount = defaultFormData.value.transportPoolCount;
  //       }
  //       if (
  //         data.transportTcpMux === undefined ||
  //         data.transportTcpMux == null
  //       ) {
  //         data.transportTcpMux = defaultFormData.value.transportTcpMux;
  //       }
  //       if (
  //         data.transportTcpMuxKeepaliveInterval === undefined ||
  //         data.transportTcpMuxKeepaliveInterval == null
  //       ) {
  //         data.transportTcpMuxKeepaliveInterval =
  //           defaultFormData.value.transportTcpMuxKeepaliveInterval;
  //       }
  //
  //       formData.value = data;
  //     }
  //   }
  //   loading.value--;
  // });
  //
  // ipcRenderer.on("Config.saveConfig.hook", (event, args) => {
  //   ElMessage({
  //     type: "success",
  //     message: "保存成功"
  //   });
  //   loading.value--;
  // });
  // ipcRenderer.on("Config.versions.hook", (event, args) => {
  //   const { err, data } = args;
  //   if (!err) {
  //     versions.value = data;
  //     checkAndResetVersion();
  //   }
  // });
  // ipcRenderer.on("Config.exportConfig.hook", (event, args) => {
  //   const { err, data } = args;
  //   console.log(err, data, "export");
  //   if (!err) {
  //     const { configPath } = data;
  //     ElMessageBox.alert(`配置路径：${configPath}`, `🎉 导出成功`);
  //   }
  // });
  // ipcRenderer.on("Config.clearAll.hook", (event, args) => {
  //   ElMessageBox.alert("重置成功 请重启软件", `提示`, {
  //     closeOnClickModal: false,
  //     showClose: false,
  //     confirmButtonText: "立即重启"
  //   }).then(() => {
  //     ipcRenderer.send("common.relaunch");
  //   });
  // });
  // ipcRenderer.on("Config.importConfig.hook", (event, args) => {
  //   const { success, data } = args;
  //   if (success) {
  //     // 礼花
  //     confetti({
  //       zIndex: 12002,
  //       particleCount: 200,
  //       spread: 70,
  //       origin: { y: 0.6 }
  //     });
  //     ElMessageBox.alert("🎉 恭喜你，导入成功 请重启软件", `提示`, {
  //       closeOnClickModal: false,
  //       showClose: false,
  //       confirmButtonText: "立即重启"
  //     }).then(() => {
  //       ipcRenderer.send("common.relaunch");
  //     });
  //   } else {
  //     ElMessageBox.alert(data, `提示`);
  //   }
  // });
  //
  // ipcRenderer.on("Config.openDataFolder.hook", (event, args) => {
  //   if (args) {
  //     ElMessage({
  //       type: "success",
  //       message: "打开数据目录成功"
  //     });
  //   }
  // });
});

const handleSelectFile = (type: number, ext: string[]) => {
  ipcRenderer.invoke("file.selectFile", ext).then(r => {
    switch (type) {
      case 1:
        formData.value.tlsConfigCertFile = r[0];
        break;
      case 2:
        formData.value.tlsConfigKeyFile = r[0];
        break;
      case 3:
        formData.value.tlsConfigTrustedCaFile = r[0];
        break;
    }
    console.log(r);
  });
};

/**
 * 分享配置
 */
const handleCopyServerConfig2Base64 = useDebounceFn(() => {
  const shareConfig: ShareLinkConfig = {
    serverAddr: formData.value.serverAddr,
    serverPort: formData.value.serverPort,
    authMethod: formData.value.authMethod,
    authToken: formData.value.authToken,
    transportHeartbeatInterval: formData.value.transportHeartbeatInterval,
    transportHeartbeatTimeout: formData.value.transportHeartbeatTimeout,
    user: formData.value.user,
    metaToken: formData.value.metaToken
  };
  const base64str = Base64.encode(JSON.stringify(shareConfig));
  copyServerConfigBase64.value = protocol.value + base64str;
  visibles.copyServerConfig = true;
}, 300);

/**
 * 导入配置
 */
const handlePasteServerConfig4Base64 = useDebounceFn(() => {
  visibles.pasteServerConfig = true;
}, 300);

const handlePasteServerConfigBase64 = useDebounceFn(() => {
  const tips = () => {
    ElMessage({
      type: "warning",
      message: "链接不正确 请输入正确的链接"
    });
  };
  if (!pasteServerConfigBase64.value.startsWith(protocol.value)) {
    tips();
    return;
  }
  const ciphertext = pasteServerConfigBase64.value.replace("frp://", "");
  const plaintext = Base64.decode(ciphertext);
  console.log("plain", plaintext);
  let serverConfig: ShareLinkConfig = null;
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
  formData.value.serverAddr = serverConfig.serverAddr;
  formData.value.serverPort = serverConfig.serverPort;
  formData.value.authMethod = serverConfig.authMethod;
  formData.value.authToken = serverConfig.authToken;
  formData.value.transportHeartbeatInterval =
    serverConfig.transportHeartbeatInterval;
  formData.value.transportHeartbeatTimeout =
    serverConfig.transportHeartbeatTimeout;
  formData.value.user = serverConfig.user;
  formData.value.metaToken = serverConfig.metaToken;

  handleSubmit();
  pasteServerConfigBase64.value = "";
  visibles.pasteServerConfig = false;
}, 300);

const handleShowExportDialog = () => {
  visibles.exportConfig = true;
};

const handleExportConfig = useDebounceFn(() => {
  ipcRenderer.send("config.exportConfig", exportConfigType.value);
  visibles.exportConfig = false;
}, 300);

const handleImportConfig = () => {
  ipcRenderer.send("config.importConfig");
};

const handleResetConfig = () => {
  ElMessageBox.alert("是否清空所有配置？", "提示", {
    showCancelButton: true,
    cancelButtonText: "取消",
    confirmButtonText: "清空"
  }).then(() => {
    ipcRenderer.send("config.clearAll");
  });
};

/**
 * 打开数据目录
 */
const handleOpenDataFolder = useDebounceFn(() => {
  ipcRenderer.send("config.openDataFolder");
}, 1000);

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Config.getConfig.hook");
  ipcRenderer.removeAllListeners("Config.saveConfig.hook");
  ipcRenderer.removeAllListeners("Config.versions.hook");
  ipcRenderer.removeAllListeners("Config.exportConfig.hook");
  ipcRenderer.removeAllListeners("Config.clearAll.hook");
  ipcRenderer.removeAllListeners("Config.openDataFolder.hook");
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
      <el-button plain type="primary" @click="handleShowExportDialog">
        <IconifyIconOffline icon="file-save-rounded" />
      </el-button>
      <el-button type="primary" @click="handleSubmit">
        <IconifyIconOffline icon="save-rounded" />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb pr-2" v-loading="loading > 0">
      <div class="w-full bg-white p-4 rounded drop-shadow-lg">
        <el-form
          :model="formData"
          :rules="rules"
          label-position="right"
          ref="formRef"
          label-width="150"
        >
          <el-row :gutter="10">
            <el-col :span="24">
              <div class="h2 flex justify-between">
                <div>版本选择</div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item label="Frp版本：" prop="frpcVersion">
                <el-select
                  v-model="formData.frpcVersion"
                  class="w-full"
                  clearable
                >
                  <el-option
                    v-for="v in versions"
                    :key="v.id"
                    :label="v.name"
                    :value="v.id"
                  ></el-option>
                </el-select>
                <div class="w-full flex justify-end">
                  <el-link type="primary" @click="handleLoadVersions">
                    <iconify-icon-offline class="mr-1" icon="refresh-rounded" />
                    手动刷新
                  </el-link>
                  <el-link
                    class="ml-2"
                    type="primary"
                    @click="$router.replace({ name: 'Download' })"
                  >
                    <IconifyIconOffline class="mr-1" icon="download" />
                    点击这里去下载
                  </el-link>
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2 flex justify-between">
                <div>服务器配置</div>
                <div class="flex items-center justify-center">
                  <IconifyIconOffline
                    @click="handleCopyServerConfig2Base64"
                    class="mr-2 cursor-pointer text-xl font-bold"
                    icon="content-copy"
                  />
                  <IconifyIconOffline
                    @click="handlePasteServerConfig4Base64"
                    class="mr-2 cursor-pointer text-xl font-bold"
                    icon="content-paste-go"
                  />
                </div>
              </div>
            </el-col>
            <el-col :span="24">
              <el-form-item label="服务器地址：" prop="serverAddr">
                <template #label>
                  <div class="h-full flex items-center mr-1">
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
                  服务器地址：
                </template>
                <el-input
                  v-model="formData.serverAddr"
                  placeholder="127.0.0.1"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="服务器端口：" prop="serverPort">
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
              <el-form-item label="验证方式：" prop="auth.method">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="200" placement="top" trigger="hover">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  验证方式：
                </template>
                <el-select
                  v-model="formData.auth.method"
                  placeholder="请选择验证方式"
                  @change="handleAuthMethodChange"
                  clearable
                >
                  <el-option label="无" value=""></el-option>
                  <el-option label="令牌（token）" value="token"></el-option>
                  <el-option label="多用户" value="multiuser"></el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="24" v-if="formData.auth.method === 'token'">
              <el-form-item label="令牌：" prop="authToken">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover placement="top" trigger="hover" width="200">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  令牌：
                </template>
                <el-input
                  placeholder="token"
                  type="password"
                  v-model="formData.auth.token"
                  :show-password="true"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.auth.method === 'multiuser'">
              <el-form-item label="用户：" prop="user">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover placement="top" trigger="hover">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  用户：
                </template>
                <el-input placeholder="请输入用户" v-model="formData.user" />
              </el-form-item>
            </el-col>
            <el-col :span="12" v-if="formData.auth.method === 'multiuser'">
              <el-form-item label="用户令牌：" prop="metaToken">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="200" placement="top" trigger="hover">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  用户令牌：
                </template>
                <el-input
                  placeholder="请输入用户令牌"
                  type="password"
                  v-model="formData.metadatas.token"
                />
              </el-form-item>
            </el-col>
            <!-- <el-col :span="24">
              <div class="h2">TLS Config</div>
            </el-col> -->

            <el-col :span="24">
              <div class="h2">传输配置</div>
            </el-col>
            <el-col :span="12">
              <el-form-item label="传输协议：" prop="transport.protocol">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        和 frps 之间的通信协议。默认为 tcp。<br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  传输协议：
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
              <el-form-item label="连接池大小：" prop="transport.poolCount">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  连接池大小：
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
                label="心跳间隔："
                prop="transport.heartbeatInterval"
              >
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        多长向服务端发发送一次心跳包 单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  心跳间隔：
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
                label="心跳超时："
                prop="transport.heartbeatTimeout"
              >
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        心跳超时时间 单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  心跳超时：
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
                label="连接超时："
                prop="transport.dialServerTimeout"
              >
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        与服务器建立连接的最长等待时间。默认值为10秒。单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  连接超时：
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
                label="保活探测间隔："
                prop="transport.dialServerKeepalive"
              >
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        客户端与服务端之间的连接在一定时间内没有任何数据传输，系统会定期发送一些心跳数据包来保持连接的活跃状态。如果为负，则禁用保活探测。
                        单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  保活探测间隔：
                </template>
                <el-input-number
                  class="w-full"
                  v-model="formData.transport.dialServerKeepalive"
                  controls-position="right"
                ></el-input-number>
              </el-form-item>
            </el-col>

            <el-col :span="12">
              <el-form-item label="多路复用：" prop="transport.tcpMux">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        TCP 多路复用，默认启用。<br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  TCP 多路复用：
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
                label="多复心跳间隔："
                prop="transport.tcpMuxKeepaliveInterval"
              >
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        多路复用的保活间隔，默认值为 30 秒。单位：
                        <span class="font-black text-[#5A3DAA]">秒</span> <br />
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  多复心跳间隔：
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
              <el-form-item label="代理地址：" prop="proxyConfigProxyUrl">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  代理地址：
                </template>
                <el-input
                  v-model="formData.transport.proxyURL"
                  placeholder="http://user:pwd@192.168.1.128:8080"
                />
              </el-form-item>
            </el-col>
            <!--            </template>-->
            <el-col :span="24">
              <el-form-item label="启用TLS：" prop="transport.tls.enable">
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
                  label="TLS证书文件："
                  prop="tlsConfigCertFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover width="260" placement="top" trigger="hover">
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]"
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
                    TLS 证书文件：
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
                    >清除
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  label="TLS密钥文件："
                  prop="transport.tls.keyFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover width="260" placement="top" trigger="hover">
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]"
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
                    TLS 密钥文件：
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
                    >清除
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  label="CA证书文件："
                  prop="transport.tls.trustedCaFile"
                  label-width="180"
                >
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover width="310" placement="top" trigger="hover">
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]"
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
                    CA 证书文件：
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
                    >清除
                  </el-button>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item
                  label="TLS Server 名称："
                  prop="tlsConfigServerName"
                  label-width="180"
                >
                  <template #label>
                    <div class="h-full flex items-center mr-1">
                      <el-popover width="300" placement="top" trigger="hover">
                        <template #default>
                          对应参数：<span class="font-black text-[#5A3DAA]"
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
                    TLS Server 名称：
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
              <div class="h2">Web 界面</div>
            </el-col>

            <!--            <el-col :span="12">-->
            <!--              <el-form-item label="启用Web界面：" prop="webEnable">-->
            <!--                <template #label>-->
            <!--                  <div class="h-full flex items-center mr-1">-->
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
              <el-form-item label="Web 端口：" prop="webPort">
                <template #label>
                  <div class="h-full flex items-center mr-1">
                    <el-popover width="300" placement="top" trigger="hover">
                      <template #default>
                        对应参数：<span class="font-black text-[#5A3DAA]"
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
                  Web 端口：
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
              <div class="h2">日志配置</div>
            </el-col>
            <el-col :span="12">
              <el-form-item class="!w-full" label="日志级别：" prop="logLevel">
                <el-select v-model="formData.log.level">
                  <el-option label="info" value="info" />
                  <el-option label="debug" value="debug" />
                  <el-option label="warn" value="warn" />
                  <el-option label="error" value="error" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item lalog.maxDaysbel="日志保留天数：" prop="">
                <el-input-number
                  class="!w-full"
                  controls-position="right"
                  v-model="formData.log.maxDays"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <div class="h2">系统配置</div>
            </el-col>
            <el-col :span="8">
              <el-form-item label="开机自启：" prop="system.launchAtStartup">
                <template #label>
                  <div class="h-full flex items-center mr-1">
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
                  开机自启：
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
              <el-form-item label="静默启动：" prop="system.silentStartup">
                <template #label>
                  <div class="h-full flex items-center mr-1">
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
                  静默启动：
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
                label="自动连接："
                prop="system.autoConnectOnStartup"
              >
                <template #label>
                  <div class="h-full flex items-center mr-1">
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
                  自动连接：
                </template>
                <el-switch
                  active-text="开"
                  inline-prompt
                  inactive-text="关"
                  v-model="formData.system.autoConnectOnStartup"
                />
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
      v-model="visibles.copyServerConfig"
      title="复制链接"
      width="500"
      top="5%"
    >
      <el-alert
        class="mb-4"
        title="生成内容包含服务器密钥等内容 请妥善保管 且链接仅在Frpc-Desktop中可用"
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
      v-model="visibles.pasteServerConfig"
      title="导入链接"
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
              class="cursor-pointer mr-2"
              icon="label-important-rounded"
            />
            导 入
          </el-button>
        </div>
      </template>
    </el-dialog>
    <!--    配置导出-->
    <el-dialog
      v-model="visibles.exportConfig"
      title="导出配置"
      width="500"
      top="5%"
    >
      <el-alert
        class="mb-4"
        :title="`导出文件名为 frpc-desktop.${exportConfigType} 重复导出则覆盖`"
        type="warning"
        :closable="false"
      />
      <el-form>
        <el-form-item label="导出类型">
          <el-radio-group v-model="exportConfigType">
            <el-radio-button label="toml" value="toml" />
            <el-radio-button label="ini" value="ini" />
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button plain type="primary" @click="handleExportConfig">
            <IconifyIconOffline
              class="cursor-pointer mr-2"
              icon="downloadRounded"
            />
            导 出
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.button-input {
  width: calc(100% - 68px);
}
</style>
