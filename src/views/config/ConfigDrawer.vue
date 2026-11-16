<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { useTunnelStore } from "@/store/tunnel";
import { on, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage, ElMessageBox, FormInstance, FormRules } from "element-plus";
import _ from "lodash";
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";
import router from "@/router";
import TunnelSettings from "./TunnelSettings.vue";
import LogConfig from "./LogConfig.vue";
import WebServerConfig from "./WebServerConfig.vue";

const drawerVisible = defineModel<boolean>({ required: true });
const props = defineProps<{
  tunnel: Pick<TunnelSummary, "id" | "name" | "autoStart"> | null;
}>();

type ConfigEditorData = OpenSourceFrpcDesktopServer & {
  instanceName: string;
  autoStart: boolean;
};

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

const defaultFormData: ConfigEditorData = {
  _id: "",
  instanceName: "",
  autoStart: false,
  multiuser: false,
  frpcVersion: null,
  customFrpcPath: "",
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
    enable: true,
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
    language: "en-US",
    appLogLevel: "info"
  },
  user: ""
};
const formData = ref<ConfigEditorData>(_.cloneDeep(defaultFormData));
const loading = ref(0);
const activeTab = ref("server");
const rules = reactive<FormRules>({
  instanceName: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        const name = (value ?? "").trim();
        callback(
          name.length > 0 && name.length <= 64
            ? undefined
            : new Error(t("tunnel.prompt.nameInvalid"))
        );
      },
      trigger: "blur"
    }
  ],
  frpcVersion: [
    {
      required: true,
      message: t("config.form.frpcVerson.requireMessage"),
      trigger: "change"
    }
  ],
  customFrpcPath: [
    {
      required: true,
      validator: (_rule: any, value: any, callback: any) => {
        if (!value?.trim()) {
          callback(new Error(t("config.form.customFrpcPath.requireMessage")));
        } else {
          callback();
        }
      },
      trigger: ["blur", "change"]
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
      required: false,
      message: t("config.form.transportProxyURL.requireMessage"),
      trigger: "change"
    },
    {
      pattern: /^https?\:\/\/(\w+:\w+@)?([a-zA-Z0-9.-]+)(:\d+)?$/,
      message: t("config.form.transportProxyURL.patternMessage"),
      trigger: "blur"
    }
  ],
  "transport.heartbeatInterval": [
    {
      required: true,
      message: t("config.form.transportHeartbeatInterval.requireMessage"),
      trigger: "change"
    }
  ],
  "transport.heartbeatTimeout": [
    {
      required: true,
      message: t("config.form.transportHeartbeatTimeout.requireMessage"),
      trigger: "change"
    }
  ],
  // webEnable: [
  //   { required: true, message: "web界面开关不能为空", trigger: "change" }
  // ],
  "webServer.port": [
    {
      required: true,
      message: t("config.form.webServerPort.requireMessage"),
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
      message: t("config.form.transportDialServerTimeout.requireMessage"),
      trigger: "change"
    }
  ],
  "transport.dialServerKeepalive": [
    {
      required: true,
      message: t("config.form.transportDialServerKeepalive.requireMessage"),
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
const formRef = ref<FormInstance>();
const currSelectLocalFileType = ref();
const detectingPath = ref(false);
const detectedVersionInfo = ref("");
const frpcDesktopStore = useFrpcDesktopStore();
const tunnelStore = useTunnelStore();
const tunnelName = computed(
  () =>
    tunnelStore.tunnels.find(item => item.id === props.tunnel?.id)?.name ??
    props.tunnel?.name ??
    ""
);
const formDirty = ref(false);
/**
 * frpc 来源二选一，只是界面状态：保存时清空未选中的一项。
 * 后端在 customFrpcPath 非空时优先使用它，否则使用 frpcVersion。
 */
const frpcSource = ref<"downloaded" | "custom">("downloaded");
let hydratingForm = true;
const listenerCleanups: Array<() => void> = [];

watch(
  formData,
  () => {
    if (!hydratingForm) formDirty.value = true;
  },
  { deep: true }
);

watch(frpcSource, () => {
  if (!hydratingForm) formDirty.value = true;
  formRef.value?.clearValidate(["frpcVersion", "customFrpcPath"]);
});

watch(
  () => frpcDesktopStore.downloadedVersions,
  (newValue, oldValue) => {
    checkAndResetVersion();
  }
);

const handleSubmit = useDebounceFn(() => {
  if (!formRef.value) return;
  formRef.value.validate(async (valid, fields) => {
    if (!valid) {
      const invalidField = formRef.value?.fields.find(
        field => fields?.[field.propString]
      );
      const tab =
        invalidField?.$el?.closest<HTMLElement>("[data-config-tab]")?.dataset
          .configTab;
      if (tab) activeTab.value = tab;
      await nextTick();
      invalidField?.$el?.scrollIntoView({ block: "center" });
      invalidField?.$el
        ?.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex="0"]'
        )
        ?.focus({ preventScroll: true });
      return;
    }
    loading.value = 1;
    const data = _.cloneDeep(formData.value);
    if (frpcSource.value === "custom") {
      data.customFrpcPath = data.customFrpcPath.trim();
      data.frpcVersion = null;
    } else {
      data.customFrpcPath = "";
    }
    send(ipcRouters.SERVER.saveConfig, {
      ...data,
      name: data.instanceName.trim(),
      autoStart: data.autoStart
    });
  });
}, 300);

const handleKeydown = (e: KeyboardEvent) => {
  if (!drawerVisible.value) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    handleSubmit();
  }
};

const handleMultiuserChange = e => {
  if (e) {
    ElMessageBox.alert(
      t("config.alert.multiuserAlert.message"),
      t("config.alert.multiuserAlert.title"),
      {
        // if you want to disable its autofocus
        autofocus: false,
        type: "info",
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
  if (!props.tunnel) return;
  loading.value = 1;
  send(ipcRouters.SERVER.getServerConfig, {
    tunnelId: props.tunnel.id
  });
};

const handleBeforeClose = (done: () => void) => {
  if (!formDirty.value) {
    done();
    return;
  }
  ElMessageBox.confirm(
    t("tunnel.closeDirty.message"),
    t("tunnel.closeDirty.title"),
    {
      type: "warning",
      confirmButtonText: t("tunnel.closeDirty.confirm"),
      cancelButtonText: t("tunnel.closeDirty.cancel")
    }
  )
    .then(() => done())
    .catch(() => {});
};

const handleGoToDownload = () => {
  handleBeforeClose(() => {
    drawerVisible.value = false;
    router.push({ name: "Download" });
  });
};

watch(
  () => [drawerVisible.value, props.tunnel?.id],
  ([open]) => {
    hydratingForm = true;
    formDirty.value = false;
    formRef.value?.clearValidate();
    detectedVersionInfo.value = "";
    if (open) {
      formData.value = _.cloneDeep(defaultFormData);
      formData.value.instanceName =
        tunnelName.value || props.tunnel?.name || "";
      formData.value.autoStart = props.tunnel?.autoStart ?? false;
      activeTab.value = "server";
      frpcSource.value = "downloaded";
      handleLoadSavedConfig();
    }
  }
);

onMounted(() => {
  listenerCleanups.push(
    on(ipcRouters.SERVER.getServerConfig, data => {
      // 代理页等其他地方发出的请求，或关闭后迟到的响应，不覆盖当前实例的表单
      if (!drawerVisible.value || (data && data._id !== props.tunnel?.id)) {
        return;
      }
      hydratingForm = true;
      if (data) {
        const { instanceName, autoStart } = formData.value;
        formData.value = {
          ...data,
          instanceName,
          autoStart
        };
        Object.keys(defaultFormData).forEach(key => {
          if (
            formData.value[key] === undefined ||
            formData.value[key] === null
          ) {
            if (key !== "frpcVersion") {
              formData.value[key] = defaultFormData[key];
            }
          }
        });
        checkAndResetVersion();
        frpcSource.value = formData.value.customFrpcPath?.trim()
          ? "custom"
          : "downloaded";
        if (formData.value.customFrpcPath) {
          handleValidateCustomPath();
        }
      }
      loading.value = 0;
      formDirty.value = false;
      nextTick(() => {
        hydratingForm = false;
      });
    })
  );

  // on(ipcRouters.VERSION.getDownloadedVersions, data => {
  //   // versions.value = data;
  //   checkAndResetVersion();
  // });

  listenerCleanups.push(
    on(ipcRouters.SERVER.saveConfig, () => {
      ElMessage({
        type: "success",
        message: t("config.message.saveSuccess")
      });
      loading.value = 0;
      formData.value.instanceName = formData.value.instanceName.trim();
      formDirty.value = false;
      tunnelStore.refreshTunnels();
    })
  );

  listenerCleanups.push(
    on(ipcRouters.SYSTEM.selectLocalFile, data => {
      // 代理页也会选择文件，只处理抽屉打开时发起的选择
      if (!drawerVisible.value) return;
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
          case 4:
            formData.value.customFrpcPath = data.path as string;
            handleValidateCustomPath();
            break;
        }
      }
    })
  );

  listenerCleanups.push(
    on(ipcRouters.VERSION.detectFrpcPath, (data: any) => {
      detectingPath.value = false;
      if (data?.found && data.path) {
        formData.value.customFrpcPath = data.path;
        if (data.version) {
          detectedVersionInfo.value = data.version;
        }
        ElMessage({
          type: "success",
          message:
            t("config.form.customFrpcPath.autoDetectSuccess") +
            " " +
            data.path +
            (data.version ? ` (${data.version})` : "")
        });
        formRef.value?.validateField("customFrpcPath");
      } else {
        ElMessage({
          type: "warning",
          message: t("config.form.customFrpcPath.autoDetectNotFound")
        });
      }
    })
  );

  listenerCleanups.push(
    on(ipcRouters.VERSION.validateFrpcPath, (data: any) => {
      if (data?.valid) {
        detectedVersionInfo.value = data.version || "OK";
      } else {
        detectedVersionInfo.value = "";
      }
    })
  );

  // ElMessageBox.alert(data, `提示`);
  window.addEventListener("keydown", handleKeydown);
});

const handleSelectFile = (type: number, ext: string[]) => {
  currSelectLocalFileType.value = type;
  send(ipcRouters.SYSTEM.selectLocalFile, {
    name: "",
    extensions: ext
  });
};

const handleDetectFrpcPath = () => {
  detectingPath.value = true;
  send(ipcRouters.VERSION.detectFrpcPath);
};

const handleSelectCustomFrpcFile = () => {
  handleSelectFile(4, []);
};

const handleValidateCustomPath = useDebounceFn(() => {
  const path = formData.value.customFrpcPath?.trim();
  if (!path) {
    detectedVersionInfo.value = "";
    return;
  }
  send(ipcRouters.VERSION.validateFrpcPath, { path });
}, 300);

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  listenerCleanups.splice(0).forEach(off => off());
});
</script>
<template>
  <el-drawer
    v-model="drawerVisible"
    size="min(960px, 92%)"
    class="config-drawer"
    :before-close="handleBeforeClose"
  >
    <template #header="{ titleId, titleClass }">
      <h2 :id="titleId" :class="titleClass" :title="tunnelName">
        {{ t("tunnel.config.title", { name: tunnelName }) }}
      </h2>
    </template>
    <div v-loading="loading > 0" class="pr-2">
      <div class="w-full">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="rules"
          label-position="right"
          label-width="150"
        >
          <el-tabs v-model="activeTab" class="config-tabs">
            <el-tab-pane name="instance" data-config-tab="instance">
              <template #label>
                <span class="config-tab-label">
                  <IconifyIconOffline class="text-base" icon="settings" />
                  {{ t("config.tab.instance") }}
                </span>
              </template>
              <TunnelSettings
                v-if="drawerVisible && tunnel"
                :key="tunnel.id"
                v-model:name="formData.instanceName"
                v-model:auto-start="formData.autoStart"
                :tunnel="tunnel"
              />
            </el-tab-pane>
            <el-tab-pane name="server" data-config-tab="server">
              <template #label>
                <span class="config-tab-label">
                  <IconifyIconOffline class="text-base" icon="dns-outline" />
                  {{ t("config.tab.server") }}
                </span>
              </template>
              <el-row :gutter="10">
                <el-col :span="24">
                  <div class="flex justify-between h2">
                    <div>{{ t("config.title.versionSelection") }}</div>
                  </div>
                </el-col>
                <el-col :span="24">
                  <el-form-item :label="t('config.form.frpcSource.label')">
                    <el-radio-group v-model="frpcSource">
                      <el-radio-button value="downloaded">
                        {{ t("config.form.frpcSource.downloaded") }}
                      </el-radio-button>
                      <el-radio-button value="custom">
                        {{ t("config.form.frpcSource.custom") }}
                      </el-radio-button>
                    </el-radio-group>
                  </el-form-item>
                </el-col>
                <el-col v-if="frpcSource === 'downloaded'" :span="24">
                  <el-form-item
                    :label="t('config.form.frpcVerson.label')"
                    prop="frpcVersion"
                  >
                    <el-select
                      v-model="formData.frpcVersion"
                      class="w-full"
                      clearable
                      :placeholder="t('config.form.frpcVerson.placeholder')"
                      :no-data-text="t('config.form.frpcVerson.empty')"
                    >
                      <el-option
                        v-for="v in frpcDesktopStore.downloadedVersions"
                        :key="v.githubReleaseId"
                        :label="v.name"
                        :value="v.githubReleaseId"
                      />
                    </el-select>
                    <div class="flex justify-end mt-1 w-full">
                      <el-link
                        type="primary"
                        @click="frpcDesktopStore.refreshDownloadedVersion()"
                      >
                        <IconifyIconOffline
                          class="mr-1"
                          icon="refresh-rounded"
                        />
                        {{ t("config.button.manualRefresh") }}
                      </el-link>
                      <el-link
                        class="ml-2"
                        type="primary"
                        @click="handleGoToDownload"
                      >
                        <IconifyIconOffline class="mr-1" icon="download" />
                        {{ t("config.button.goToDownload") }}
                      </el-link>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col v-else :span="24">
                  <el-form-item
                    :label="t('config.form.customFrpcPath.label')"
                    prop="customFrpcPath"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover placement="top" width="320" trigger="hover">
                          <template #default>
                            <div
                              v-html="t('config.form.customFrpcPath.tips')"
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.customFrpcPath.label") }}
                    </template>
                    <div class="flex gap-2 items-center w-full">
                      <el-input
                        v-model="formData.customFrpcPath"
                        :placeholder="
                          t('config.form.customFrpcPath.placeholder')
                        "
                        clearable
                        @input="handleValidateCustomPath"
                        @clear="handleValidateCustomPath"
                      />
                      <el-button
                        :loading="detectingPath"
                        type="primary"
                        @click="handleDetectFrpcPath"
                      >
                        <IconifyIconOffline
                          class="mr-1"
                          icon="refresh-rounded"
                        />
                        {{ t("config.button.autoDetect") }}
                      </el-button>
                      <el-button @click="handleSelectCustomFrpcFile">
                        <IconifyIconOffline
                          class="mr-1"
                          icon="file-open-rounded"
                        />
                        {{ t("config.button.browse") }}
                      </el-button>
                    </div>
                    <div
                      v-if="detectedVersionInfo"
                      class="flex items-center mt-1 w-full text-xs text-text_color_secondary"
                    >
                      <span class="mr-1.5">
                        {{ t("config.form.customFrpcPath.detectedVersion") }}:
                      </span>
                      <el-tag size="small" type="success">
                        {{ detectedVersionInfo }}
                      </el-tag>
                    </div>
                  </el-form-item>
                </el-col>
                <el-col :span="24">
                  <div class="h2">
                    {{ t("config.title.serverConfiguration") }}
                  </div>
                </el-col>
                <el-col :span="24">
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
                              color="var(--app-primary-text)"
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
                      v-model="formData.serverPort"
                      placeholder="7000"
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
                      <div class="flex items-center mr-1 h-full">
                        <el-popover width="300" placement="top" trigger="hover">
                          <template #default>
                            {{ t("config.popover.frpParameter") }}:
                            <span class="font-black text-primary"
                              >auth.method</span
                            >
                          </template>
                          <template #reference>
                            <!--                        <IconifyIconOffline class="text-base" color="var(--app-primary-text)" icon="info"/>-->
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.authMethod.label") }}
                    </template>
                    <el-select
                      v-model="formData.auth.method"
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
                <el-col v-if="formData.auth.method === 'token'" :span="24">
                  <el-form-item
                    :label="t('config.form.authToken.label')"
                    prop="authToken"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("config.popover.frpParameter") }}:<span
                              class="font-black text-primary"
                              >auth.token</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.authToken.label") }}
                    </template>
                    <el-input
                      v-model="formData.auth.token"
                      placeholder="token"
                      type="password"
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
                          color="var(--app-primary-text)"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t("config.form.multiuser.label") }}
                </template>
                -->
                    <el-switch
                      v-model="formData.multiuser"
                      :active-text="t('common.yes')"
                      :inactive-text="t('common.no')"
                      inline-prompt
                      @change="handleMultiuserChange"
                    />
                  </el-form-item>
                </el-col>
                <el-col v-if="formData.multiuser" :span="12">
                  <el-form-item
                    :label="t('config.form.user.label')"
                    prop="user"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover placement="top" trigger="hover" width="300">
                          <template #default>
                            {{ t("config.popover.frpParameter") }}:<span
                              class="font-black text-primary"
                              >user</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.user.label") }}
                    </template>
                    <el-input
                      v-model="formData.user"
                      :placeholder="t('config.form.user.placeholder')"
                    />
                  </el-form-item>
                </el-col>
                <el-col v-if="formData.multiuser" :span="12">
                  <el-form-item
                    :label="t('config.form.metadatasToken.label')"
                    prop="metadatas.token"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover width="300" placement="top" trigger="hover">
                          <template #default>
                            {{ t("config.popover.frpParameter") }}:<span
                              class="font-black text-primary"
                              >metadatas.token</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.metadatasToken.label") }}
                    </template>
                    <el-input
                      v-model="formData.metadatas.token"
                      :placeholder="t('config.form.metadatasToken.placeholder')"
                      type="password"
                      :show-password="true"
                    />
                  </el-form-item>
                </el-col>
                <!-- <el-col :span="24">
              <div class="h2">TLS Config</div>
            </el-col> -->
              </el-row>
            </el-tab-pane>
            <el-tab-pane name="transport" data-config-tab="transport">
              <template #label>
                <span class="config-tab-label">
                  <IconifyIconOffline class="text-base" icon="lan-outline" />
                  {{ t("config.tab.transport") }}
                </span>
              </template>
              <el-row :gutter="10">
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
                              color="var(--app-primary-text)"
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
                    label-width="180"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover width="300" placement="top" trigger="hover">
                          <template #default>
                            {{ t("config.popover.frpParameter") }}:<span
                              class="font-black text-primary"
                              >transport.poolCount</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.transportPoolCount.label") }}
                    </template>
                    <el-input-number
                      v-model="formData.transport.poolCount"
                      class="w-full"
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
                                t(
                                  'config.form.transportHeartbeatInterval.tips',
                                  {
                                    frpParameter: t(
                                      'config.popover.frpParameter'
                                    )
                                  }
                                )
                              "
                            />
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.transportHeartbeatInterval.label") }}
                    </template>
                    <el-input-number
                      v-model="formData.transport.heartbeatInterval"
                      class="w-full"
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
                    label-width="180"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover width="300" placement="top" trigger="hover">
                          <template #default>
                            <div
                              v-html="
                                t(
                                  'config.form.transportHeartbeatTimeout.tips',
                                  {
                                    frpParameter: t(
                                      'config.popover.frpParameter'
                                    )
                                  }
                                )
                              "
                            />
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.transportHeartbeatTimeout.label") }}
                    </template>
                    <el-input-number
                      v-model="formData.transport.heartbeatTimeout"
                      class="w-full"
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
                    label-width="180"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover width="300" placement="top" trigger="hover">
                          <template #default>
                            <div
                              v-html="
                                t(
                                  'config.form.transportDialServerTimeout.tips',
                                  {
                                    frpParameter: t(
                                      'config.popover.frpParameter'
                                    )
                                  }
                                )
                              "
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.transportDialServerTimeout.label") }}
                    </template>
                    <el-input-number
                      v-model="formData.transport.dialServerTimeout"
                      class="w-full"
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
                                t(
                                  'config.form.transportDialServerKeepalive.tips',
                                  {
                                    frpParameter: t(
                                      'config.popover.frpParameter'
                                    )
                                  }
                                )
                              "
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.transportDialServerKeepalive.label") }}
                    </template>
                    <el-input-number
                      v-model="formData.transport.dialServerKeepalive"
                      class="w-full"
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
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{ t("config.form.transportTcpMux.label") }}
                    </template>
                    <el-switch
                      v-model="formData.transport.tcpMux"
                      :active-text="t('common.yes')"
                      inline-prompt
                      :inactive-text="t('common.no')"
                    />
                  </el-form-item>
                </el-col>
                <el-col v-if="formData.transport.tcpMux" :span="12">
                  <el-form-item
                    :label="
                      t('config.form.transportTcpMuxKeepaliveInterval.label')
                    "
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
                                    frpParameter: t(
                                      'config.popover.frpParameter'
                                    )
                                  }
                                )
                              "
                            ></div>
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
                              icon="info"
                            />
                          </template>
                        </el-popover>
                      </div>
                      {{
                        t("config.form.transportTcpMuxKeepaliveInterval.label")
                      }}
                    </template>
                    <el-input-number
                      v-model="formData.transport.tcpMuxKeepaliveInterval"
                      class="w-full"
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
                    label-width="180"
                  >
                    <template #label>
                      <div class="flex items-center mr-1 h-full">
                        <el-popover width="300" placement="top" trigger="hover">
                          <template #default>
                            {{ t("config.popover.frpParameter") }}:<span
                              class="font-black text-primary"
                              >transport.proxyURL</span
                            >
                          </template>
                          <template #reference>
                            <IconifyIconOffline
                              class="text-base"
                              color="var(--app-primary-text)"
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
                    label-width="180"
                  >
                    <el-switch
                      v-model="formData.transport.tls.enable"
                      :active-text="t('common.yes')"
                      :inactive-text="t('common.no')"
                      inline-prompt
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
                        <div class="flex items-center mr-1 h-full">
                          <el-popover
                            width="300"
                            placement="top"
                            trigger="hover"
                          >
                            <template #default>
                              {{ t("config.popover.frpParameter") }}:<span
                                class="font-black text-primary"
                                >transport.tls.certFile</span
                              >
                            </template>
                            <template #reference>
                              <IconifyIconOffline
                                class="text-base"
                                color="var(--app-primary-text)"
                                icon="info"
                              />
                            </template>
                          </el-popover>
                        </div>
                        {{ t("config.form.tlsCertFile.label") }}
                      </template>
                      <el-input
                        v-model="formData.transport.tls.certFile"
                        class="button-input !cursor-pointer"
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
                        <div class="flex items-center mr-1 h-full">
                          <el-popover
                            width="300"
                            placement="top"
                            trigger="hover"
                          >
                            <template #default>
                              {{ t("config.popover.frpParameter") }}:<span
                                class="font-black text-primary"
                                >transport.tls.keyFile</span
                              >
                            </template>
                            <template #reference>
                              <IconifyIconOffline
                                class="text-base"
                                color="var(--app-primary-text)"
                                icon="info"
                              />
                            </template>
                          </el-popover>
                        </div>
                        {{ t("config.form.tlsKeyFile.label") }}
                      </template>
                      <el-input
                        v-model="formData.transport.tls.keyFile"
                        class="button-input"
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
                        <div class="flex items-center mr-1 h-full">
                          <el-popover
                            width="300"
                            placement="top"
                            trigger="hover"
                          >
                            <template #default>
                              {{ t("config.popover.frpParameter") }}:<span
                                class="font-black text-primary"
                                >transport.tls.trustedCaFile</span
                              >
                            </template>
                            <template #reference>
                              <IconifyIconOffline
                                class="text-base"
                                color="var(--app-primary-text)"
                                icon="info"
                              />
                            </template>
                          </el-popover>
                        </div>
                        {{ t("config.form.caCertFile.label") }}
                      </template>
                      <el-input
                        v-model="formData.transport.tls.trustedCaFile"
                        class="button-input"
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
                        <div class="flex items-center mr-1 h-full">
                          <el-popover
                            width="300"
                            placement="top"
                            trigger="hover"
                          >
                            <template #default>
                              {{ t("config.popover.frpParameter") }}:<span
                                class="font-black text-primary"
                                >transport.tls.serverName</span
                              >
                            </template>
                            <template #reference>
                              <IconifyIconOffline
                                class="text-base"
                                color="var(--app-primary-text)"
                                icon="info"
                              />
                            </template>
                          </el-popover>
                        </div>
                        {{ t("config.form.tlsServerName.label") }}
                      </template>
                      <el-input
                        v-model="formData.transport.tls.serverName"
                        :placeholder="
                          t('config.form.tlsServerName.placeholder')
                        "
                        clearable
                      />
                    </el-form-item>
                  </el-col>
                </template>
              </el-row>
            </el-tab-pane>
            <el-tab-pane name="web" data-config-tab="web">
              <template #label>
                <span class="config-tab-label">
                  <IconifyIconOffline class="text-base" icon="public" />
                  {{ t("config.tab.web") }}
                </span>
              </template>
              <el-row :gutter="10">
                <WebServerConfig v-model="formData" embedded />
              </el-row>
            </el-tab-pane>
            <el-tab-pane name="log" data-config-tab="log">
              <template #label>
                <span class="config-tab-label">
                  <IconifyIconOffline class="text-base" icon="description" />
                  {{ t("config.tab.log") }}
                </span>
              </template>
              <el-row :gutter="10">
                <LogConfig v-model="formData" embedded />
              </el-row>
            </el-tab-pane>
          </el-tabs>
        </el-form>
      </div>
    </div>
    <template #footer>
      <el-button @click="handleBeforeClose(() => (drawerVisible = false))">
        <IconifyIconOffline class="mr-2" icon="cancel-presentation" />
        {{ t("common.close") }}
      </el-button>
      <el-button
        type="primary"
        :title="t('config.button.saveWithShortcut')"
        @click="handleSubmit"
      >
        <IconifyIconOffline class="mr-2" icon="save-rounded" />
        {{ t("common.save") }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style lang="scss" scoped>
.button-input {
  width: calc(100% - 68px);
}

.config-link-textarea {
  display: block;
}
</style>

<style lang="scss">
/* 抽屉和链接弹窗挂载到 body，scoped 样式无法作用到它们 */
.config-drawer {
  .el-drawer__header {
    gap: 12px;
    margin-bottom: 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--app-border);
  }

  .el-drawer__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .el-drawer__footer {
    padding-top: 12px;
    border-top: 1px solid var(--app-border);
  }

  /* 配置分组使用胶囊式 Tab：比默认下划线更紧凑，长表单滚动时吸顶 */
  .config-tabs {
    .el-tabs__header {
      position: sticky;
      top: 0;
      z-index: 3;
      margin-bottom: 12px;
      padding: 4px 0 12px;
      background: var(--el-bg-color);
    }

    .el-tabs__nav-wrap::after {
      display: none;
    }

    .el-tabs__nav {
      display: inline-flex;
      gap: 2px;
      padding: 4px;
      background: var(--app-page-bg);
      border: 1px solid var(--app-border);
      border-radius: var(--app-radius);
    }

    .el-tabs__active-bar {
      display: none;
    }

    .el-tabs__item {
      height: 32px;
      padding: 0 12px;
      border: 1px solid transparent;
      border-radius: 7px;
      color: var(--el-text-color-regular);
      font-weight: 500;
      transition:
        color 0.18s ease,
        background-color 0.18s ease,
        border-color 0.18s ease;

      &:hover {
        color: var(--app-primary-text);
      }

      &.is-active {
        color: var(--app-primary-text);
        background: var(--app-surface);
        border-color: var(--app-border);
        box-shadow: var(--app-shadow);
        font-weight: 600;
      }

      &:focus-visible {
        outline: 2px solid var(--app-primary-text);
        outline-offset: 2px;
      }
    }

    /* 覆盖 Element Plus 对首尾项去除内边距的规则 */
    .el-tabs__item:nth-child(2),
    .el-tabs__item:last-child {
      padding-right: 12px;
      padding-left: 12px;
    }
  }

  .config-tab-label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
}

.config-link-dialog {
  display: flex;
  max-height: 90vh;
  flex-direction: column;

  .el-dialog__body {
    min-height: 0;
    overflow-y: auto;
  }
}
</style>
