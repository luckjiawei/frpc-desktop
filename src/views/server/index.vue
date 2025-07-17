<script setup lang="ts">
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { ElMessage, FormInstance, FormRules } from "element-plus";
import _ from "lodash";
import { defineComponent, onMounted, onUnmounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";

defineComponent({
  name: "Server"
});
const { t } = useI18n();
const loading = ref({
  list: 0
});
const servers = ref<Array<FrpcDesktopServer>>([]);
const edit = ref({
  title: t("server.createTitle"),
  visible: false
});

const defaultForm: FrpcDesktopServer = {
  _id: "",
  name: "",
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
  user: ""
};
const editForm = ref<FrpcDesktopServer>(_.cloneDeep(defaultForm));
const editFormRules = reactive<FormRules>({
  frpcVersion: [
    {
      required: true,
      message: t("config.form.frpcVerson.requireMessage"),
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      message: t("config.form.name.requireMessage"),
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
  "transport.poolCount": [
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
const frpcDesktopStore = useFrpcDesktopStore();
const currSelectLocalFileType = ref();
const editFormRef = ref<FormInstance>();

const handleOpenInsert = () => {
  edit.value = {
    title: t("server.createTitle"),
    visible: true
  };
};

const handleSelectFile = (type: number, ext: string[]) => {
  currSelectLocalFileType.value = type;
  send(ipcRouters.SYSTEM.selectLocalFile, {
    name: "",
    extensions: ext
  });
};

const handleSubmit = () => {
  if (!editFormRef.value) return;
  editFormRef.value.validate(valid => {
    if (valid) {
      const data = _.cloneDeep(editForm.value);
      console.log("submit", data);
      if (data._id) {
        send(ipcRouters.MANY_SERVER.modifyServer, data);
      } else {
        send(ipcRouters.MANY_SERVER.createServer, data);
      }
    }
  });
};

const handleRandomProxyName = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  editForm.value.name = `frpc_desktop_${result}`.toLocaleLowerCase();
};

const handleLoadServers = () => {
  send(ipcRouters.MANY_SERVER.getAllServers);
};

const handleDeleteServer = (server: FrpcDesktopServer) => {
  send(ipcRouters.MANY_SERVER.deleteServer, server._id);
};

const insertOrUpdateHook = (message: string) => {
  loading.value.form--;
  // const { err } = args;
  // if (!err) {
  ElMessage({
    type: "success",
    message: message
  });
  // handleResetForm();
  handleLoadServers();
  edit.value.visible = false;
  // }
};

const handleOpenUpdate = (server: FrpcDesktopServer) => {
  editForm.value = _.cloneDeep(server);
  // if (!editForm.value.fallbackTimeoutMs) {
  //   editForm.value.fallbackTimeoutMs = defaultForm.fallbackTimeoutMs;
  // }
  edit.value = {
    title: t("server.modifyTitle"),
    visible: true
  };
};

onMounted(() => {
  handleLoadServers();

  on(ipcRouters.MANY_SERVER.getAllServers, data => {
    loading.value.list--;
    servers.value = data;
  });

  on(ipcRouters.MANY_SERVER.createServer, data => {
    insertOrUpdateHook(t("common.createSuccess"));
  });

  on(ipcRouters.MANY_SERVER.modifyServer, data => {
    insertOrUpdateHook(t("common.modifySuccess"));
  });

  on(ipcRouters.MANY_SERVER.deleteServer, () => {
    handleLoadServers();
    ElMessage({
      type: "success",
      message: t("common.deleteSuccess")
    });
  });

  on(ipcRouters.SYSTEM.selectLocalFile, data => {
    console.log("data", data);
    if (!data.canceled) {
      switch (currSelectLocalFileType.value) {
        case 1:
          editForm.value.transport.tls.certFile = data.path as string;
          // tlsConfigCertFile = data;
          break;
        case 2:
          editForm.value.transport.tls.keyFile = data.path as string;
          break;
        case 3:
          editForm.value.transport.tls.trustedCaFile = data.path as string;
          break;
      }
    }
  });
});

onUnmounted(() => {
  removeRouterListeners(ipcRouters.SYSTEM.selectLocalFile);
  removeRouterListeners(ipcRouters.MANY_SERVER.getAllServers);
  removeRouterListeners(ipcRouters.MANY_SERVER.modifyServer);
  removeRouterListeners(ipcRouters.MANY_SERVER.createServer);
  removeRouterListeners(ipcRouters.MANY_SERVER.deleteServer);
});
</script>

<template>
  <div class="main">
    <breadcrumb>
      <el-button type="primary" @click="handleOpenInsert">
        <IconifyIconOffline icon="add" />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb" v-loading="loading.list > 0">
      <template v-if="servers && servers.length > 0">
        <el-row :gutter="15">
          <el-col
            v-for="server in servers"
            :key="server._id"
            :lg="8"
            :md="8"
            :sm="12"
            :xl="6"
            :xs="12"
            class="mb-[15px]"
          >
            <div
              class="flex justify-between items-center p-4 w-full h-full bg-white rounded drop-shadow left-border animate__animated"
            >
              <div class="left">
                <div class="flex items-center">
                  <span class="mr-2 font-bold text-primary">{{
                    server.name
                  }}</span>
                </div>
                <div class="mb-1">
                  <el-tag size="small"
                    >{{ (server as any).frpcVersionName }}
                  </el-tag>
                </div>
                <div class="h-[36px]">
                  <div class="text-[12px]">
                    <span>{{ t("server.serverAddr") }}：</span>
                    <span
                      class="font-bold underline cursor-pointer text-primary"
                      >{{ server.serverAddr }}</span>
                  </div>
                  <div class="text-[12px]">
                    <span>{{ t("server.serverPort") }}：</span>
                    <span
                      class="font-bold underline cursor-pointer text-primary"
                    >{{ server.serverPort }}</span>
                  </div>
                </div>
              </div>

              <div class="right">
                <div class="flex flex-col gap-1 items-center">
                  <el-button
                    type="text"
                    size="small"
                    @click="handleOpenUpdate(server)"
                  >
                    <template #icon>
                      <IconifyIconOffline icon="edit" />
                    </template>
                    {{ t("common.modify") }}
                  </el-button>
                  <el-dropdown>
                    <el-button type="text" size="small">
                      <template #icon>
                        <IconifyIconOffline icon="more-horiz" />
                      </template>
                      {{ t("common.more") }}
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleDeleteServer(server)">
                          <IconifyIconOffline
                            class="mr-1"
                            icon="delete-rounded"
                          />
                          {{ t("common.delete") }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </template>
      <div
        v-else
        class="flex overflow-hidden justify-center items-center p-2 w-full h-full bg-white rounded drop-shadow-xl"
      >
        <el-empty :description="t('server.noServer')">
          <el-button type="primary" @click="handleOpenInsert">
            <IconifyIconOffline class="mr-2 cursor-pointer" icon="add" />
            {{ t("server.addServer") }}
          </el-button>
        </el-empty>
      </div>
    </div>

    <el-drawer
      :title="edit.title"
      v-model="edit.visible"
      direction="rtl"
      size="60%"
      header-class="custom-drawer-header"
    >
      <el-form
        class="edit-server"
        :model="editForm"
        :rules="editFormRules"
        label-position="top"
        ref="editFormRef"
      >
        <el-row :gutter="10">
          <el-col :span="24">
            <div class="flex justify-between h3">
              <div>{{ t("config.title.basicConfig") }}</div>
            </div>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="t('config.form.frpcVerson.label')"
              prop="frpcVersion"
            >
              <el-select
                v-model="editForm.frpcVersion"
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
            <el-form-item :label="t('config.form.name.label')" prop="name">
              <div class="flex gap-2 w-full">
                <el-input
                  v-model="editForm.name"
                  class="w-full"
                  :placeholder="t('config.form.name.placeholder')"
                  clearable
                />
                <el-button plain type="primary" @click="handleRandomProxyName">
                  <IconifyIconOffline
                    class="mr-2 cursor-pointer"
                    icon="charger-rounded"
                  />
                  {{ t("proxy.form.button.generateName") }}
                </el-button>
              </div>
            </el-form-item>
          </el-col>

          <el-col :span="24">
            <div class="flex justify-between h2">
              <div>{{ t("config.title.serverConfiguration") }}</div>
              <!--              <div class="flex justify-center items-center">-->
              <!--                <IconifyIconOffline-->
              <!--                  @click="handleCopyServerConfig2Base64"-->
              <!--                  class="mr-2 text-xl font-bold cursor-pointer"-->
              <!--                  icon="content-copy"-->
              <!--                />-->
              <!--                <IconifyIconOffline-->
              <!--                  @click="handlePasteServerConfig4Base64"-->
              <!--                  class="mr-2 text-xl font-bold cursor-pointer"-->
              <!--                  icon="content-paste-go"-->
              <!--                />-->
              <!--              </div>-->
            </div>
          </el-col>
          <el-col :span="16">
            <el-form-item
              :label="t('config.form.serverAddr.label')"
              prop="serverAddr"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover placement="top" trigger="hover" width="300">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.serverAddr.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      ></div>
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
                v-model="editForm.serverAddr"
                placeholder="127.0.0.1"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item
              :label="t('config.form.serverPort.label')"
              prop="serverPort"
            >
              <el-input-number
                placeholder="7000"
                v-model="editForm.serverPort"
                :min="0"
                :max="65535"
                controls-position="right"
                class="!w-full"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="t('config.form.authMethod.label')"
              prop="auth.method"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      {{ t("config.popover.frpParameter") }}:
                      <span class="font-black text-[#5A3DAA]">auth.method</span>
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
                v-model="editForm.auth.method"
                :placeholder="t('config.form.authMethod.requireMessage')"
                clearable
              >
                <el-option
                  :label="t('config.form.authMethod.none')"
                  value="none"
                ></el-option>
                <el-option
                  :label="t('config.form.authMethod.token')"
                  value="token"
                ></el-option>
                <!--                  <el-option label="多用户" value="multiuser"></el-option>-->
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24" v-if="editForm.auth.method === 'token'">
            <el-form-item
              :label="t('config.form.authToken.label')"
              prop="authToken"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover placement="top" trigger="hover" width="300">
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
                v-model="editForm.auth.token"
                :show-password="true"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="t('config.form.multiuser.label')"
              prop="multiuser"
            >
              <!--
              <template #label>
                <div class="flex items-center mr-1 h-full">
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
              -->
              <el-switch
                @change="handleMultiuserChange"
                :active-text="t('common.yes')"
                :inactive-text="t('common.no')"
                inline-prompt
                v-model="editForm.multiuser"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="editForm.multiuser">
            <el-form-item :label="t('config.form.user.label')" prop="user">
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover placement="top" trigger="hover" width="300">
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
              <el-input
                :placeholder="t('config.form.user.placeholder')"
                v-model="editForm.user"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="editForm.multiuser">
            <el-form-item
              :label="t('config.form.metadatasToken.label')"
              prop="metadatas.token"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
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
                :placeholder="t('config.form.metadatasToken.placeholder')"
                type="password"
                v-model="editForm.metadatas.token"
                :show-password="true"
              />
            </el-form-item>
          </el-col>
          <!--          transport configuation-->
          <el-col :span="24">
            <div class="h2">
              {{ t("config.title.transportConfiguration") }}
            </div>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.transportProtocol.label')"
              prop="transport.protocol"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.transportProtocol.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      ></div>
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
              <el-select v-model="editForm.transport.protocol">
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
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
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
                v-model="editForm.transport.poolCount"
                controls-position="right"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.transportHeartbeatInterval.label')"
              prop="transport.heartbeatInterval"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.transportHeartbeatInterval.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      />
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
                v-model="editForm.transport.heartbeatInterval"
                :min="1"
                :max="600"
                controls-position="right"
              />
              <!--                <el-input-->
              <!--                    placeholder="请输入心跳间隔"-->
              <!--                    type="number"-->
              <!--                    :min="0"-->
              <!--                    v-model="editForm.heartbeatInterval"-->
              <!--                >-->
              <!--                  <template #append>秒</template>-->
              <!--                </el-input>-->
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.transportHeartbeatTimeout.label')"
              prop="transport.heartbeatTimeout"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.transportHeartbeatTimeout.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      />
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
                v-model="editForm.transport.heartbeatTimeout"
                :min="1"
                :max="600"
                controls-position="right"
              />
              <!--                <el-input-->
              <!--                    placeholder="请输入心跳超时时间"-->
              <!--                    :min="0"-->
              <!--                    type="number"-->
              <!--                    v-model="editForm.heartbeatTimeout"-->
              <!--                >-->
              <!--                  <template #append>秒</template>-->
              <!--                </el-input>-->
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.transportDialServerTimeout.label')"
              prop="transport.dialServerTimeout"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.transportDialServerTimeout.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      ></div>
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
                v-model="editForm.transport.dialServerTimeout"
                controls-position="right"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.transportDialServerKeepalive.label')"
              prop="transport.dialServerKeepalive"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.transportDialServerKeepalive.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      ></div>
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
                v-model="editForm.transport.dialServerKeepalive"
                controls-position="right"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.transportTcpMux.label')"
              prop="transport.tcpMux"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.transportTcpMux.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      ></div>
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
                :active-text="t('common.yes')"
                inline-prompt
                :inactive-text="t('common.no')"
                v-model="editForm.transport.tcpMux"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="editForm.transport.tcpMux">
            <el-form-item
              :label="t('config.form.transportTcpMuxKeepaliveInterval.label')"
              prop="transport.tcpMuxKeepaliveInterval"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t(
                            'config.form.transportTcpMuxKeepaliveInterval.tips',
                            {
                              frpParameter: t('config.popover.frpParameter')
                            }
                          )
                        "
                      ></div>
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
                v-model="editForm.transport.tcpMuxKeepaliveInterval"
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
          <!--                  v-model="editForm.proxyConfigEnable"-->
          <!--                />-->
          <!--              </el-form-item>-->
          <!--            </el-col>-->
          <!--            <template v-if="editForm.proxyConfigEnable">-->
          <el-col :span="24">
            <el-form-item
              :label="t('config.form.transportProxyURL.label')"
              prop="transport.proxyURL"
              label-width="180"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
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
                v-model="editForm.transport.proxyURL"
                placeholder="http://user:pwd@192.168.1.128:8080"
              />
            </el-form-item>
          </el-col>
          <!--            </template>-->
          <el-col :span="24">
            <el-form-item
              :label="t('config.form.tlsEnable.label')"
              prop="transport.tls.enable"
              label-width="180"
            >
              <el-switch
                :active-text="t('common.yes')"
                :inactive-text="t('common.no')"
                inline-prompt
                v-model="editForm.transport.tls.enable"
              />
            </el-form-item>
          </el-col>
          <template v-if="editForm.transport.tls.enable">
            <el-col :span="24">
              <el-form-item
                :label="t('config.form.tlsCertFile.label')"
                prop="tlsConfigCertFile"
                label-width="180"
              >
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
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
                  v-model="editForm.transport.tls.certFile"
                  :placeholder="t('config.form.tlsCertFile.placeholder')"
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
                  v-if="editForm.transport.tls.certFile"
                  class="ml-2"
                  type="danger"
                  @click="editForm.transport.tls.certFile = ''"
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
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
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
                  v-model="editForm.transport.tls.keyFile"
                  :placeholder="t('config.form.tlsKeyFile.placeholder')"
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
                  v-if="editForm.transport.tls.keyFile"
                  class="ml-2"
                  type="danger"
                  @click="editForm.transport.tls.keyFile = ''"
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
                  <div class="flex items-center mr-1 h-full">
                    <el-popover width="300" placement="top" trigger="hover">
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
                  v-model="editForm.transport.tls.trustedCaFile"
                  :placeholder="t('config.form.caCertFile.placeholder')"
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
                  v-if="editForm.transport.tls.trustedCaFile"
                  class="ml-2"
                  type="danger"
                  @click="editForm.transport.tls.trustedCaFile = ''"
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
                  <div class="flex items-center mr-1 h-full">
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
                  v-model="editForm.transport.tls.serverName"
                  :placeholder="t('config.form.tlsServerName.placeholder')"
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
          <!--                  <div class="flex items-center mr-1 h-full">-->
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
          <!--                  v-model="editForm.webServer."-->
          <!--                />-->
          <!--              </el-form-item>-->
          <!--            </el-col>-->

          <!--            <template v-if="editForm.webEnable">-->
          <el-col :span="12">
            <el-form-item
              :label="t('config.form.webServerPort.label')"
              prop="webPort"
            >
              <template #label>
                <div class="flex items-center mr-1 h-full">
                  <el-popover width="300" placement="top" trigger="hover">
                    <template #default>
                      <div
                        v-html="
                          t('config.form.webServerPort.tips', {
                            frpParameter: t('config.popover.frpParameter')
                          })
                        "
                      ></div>
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
                v-model="editForm.webServer.port"
                :min="0"
                :max="65535"
                controls-position="right"
                class="w-full"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <!--            </template>-->
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item>
              <div class="flex justify-end w-full">
                <el-button @click="edit.visible = false">
                  <iconify-icon-offline
                    class="mr-2 cursor-pointer"
                    icon="cancel-presentation"
                  />
                  {{ t("common.close") }}
                </el-button>
                <el-button plain type="primary" @click="handleSubmit">
                  <IconifyIconOffline
                    class="mr-2 cursor-pointer"
                    icon="save-rounded"
                  />
                  {{ t("common.save") }}
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.edit-server {
  :deep(.el-form-item__label) {
    display: flex;
    justify-content: left;
    align-items: center;
  }
}
</style>
