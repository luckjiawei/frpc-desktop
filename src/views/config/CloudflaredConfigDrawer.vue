<script lang="ts" setup>
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

const drawerVisible = defineModel<boolean>({ required: true });
const props = defineProps<{
  tunnel: Pick<TunnelSummary, "id" | "name" | "autoStart"> | null;
}>();

type CloudflaredEditorData = CloudflaredSettings & {
  instanceName: string;
  autoStart: boolean;
};

const CLOUDFLARE_DASHBOARD_URL = "https://one.dash.cloudflare.com/";
/** 连接器令牌是 base64（含 URL 安全字符）编码的 JSON，与后端校验一致 */
const TOKEN_PATTERN = /^[A-Za-z0-9+/=_-]{32,4096}$/;
/** 与应用日志级别保持一致的选项顺序与文案 */
const logLevels = ["error", "warn", "info", "debug"] as const;

const { t } = useI18n();
const frpcDesktopStore = useFrpcDesktopStore();
const tunnelStore = useTunnelStore();
const tunnelName = computed(
  () =>
    tunnelStore.tunnels.find(item => item.id === props.tunnel?.id)?.name ??
    props.tunnel?.name ??
    ""
);

const defaultFormData = (tunnelId = ""): CloudflaredEditorData => ({
  tunnelId,
  instanceName: "",
  autoStart: false,
  cloudflaredVersion: null,
  customCloudflaredPath: "",
  token: "",
  protocol: "auto",
  edgeIpVersion: "auto",
  logLevel: "info"
});

const formData = ref<CloudflaredEditorData>(defaultFormData());
const formRef = ref<FormInstance>();
const activeTab = ref("instance");
const loading = ref(false);
const saving = ref(false);
const formDirty = ref(false);
const detectingPath = ref(false);
const detectedVersionInfo = ref("");
/** 二选一的界面状态：保存时清空未选中的一项 */
const binarySource = ref<"downloaded" | "custom">("downloaded");
let hydratingForm = true;
const listenerCleanups: Array<() => void> = [];

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
  customCloudflaredPath: [
    {
      required: true,
      validator: (_rule: any, value: string, callback: any) => {
        if (binarySource.value === "custom" && !value?.trim()) {
          callback(
            new Error(t("tunnel.cloudflared.customPath.requireMessage"))
          );
        } else {
          callback();
        }
      },
      trigger: ["blur", "change"]
    }
  ],
  token: [
    {
      required: true,
      message: t("tunnel.cloudflared.token.requireMessage"),
      trigger: "blur"
    },
    {
      pattern: TOKEN_PATTERN,
      message: t("tunnel.cloudflared.token.invalidMessage"),
      trigger: "blur"
    }
  ]
});

watch(
  formData,
  () => {
    if (!hydratingForm) formDirty.value = true;
  },
  { deep: true }
);

watch(binarySource, () => {
  if (!hydratingForm) formDirty.value = true;
  formRef.value?.clearValidate(["customCloudflaredPath"]);
});

/** 已下载版本被删除后，清空失效的选择 */
const checkAndResetVersion = () => {
  const current = formData.value.cloudflaredVersion;
  if (
    current &&
    !frpcDesktopStore.downloadedCloudflaredVersions.some(
      item => item.githubReleaseId === current
    )
  ) {
    formData.value.cloudflaredVersion = null;
  }
};

watch(
  () => frpcDesktopStore.downloadedCloudflaredVersions,
  checkAndResetVersion
);

/**
 * 控制台给出的是完整安装命令（`cloudflared service install eyJ...` 或
 * `cloudflared tunnel run --token eyJ...`），粘贴后只保留其中的令牌。
 */
const handleTokenChange = (value: string) => {
  const trimmed = (value ?? "").trim();
  if (!/\s/.test(trimmed)) {
    formData.value.token = trimmed;
    return;
  }
  const match = trimmed.match(/eyJ[A-Za-z0-9+/=_-]{29,}/);
  if (match) {
    formData.value.token = match[0];
    ElMessage({
      type: "success",
      message: t("tunnel.cloudflared.token.extracted")
    });
  }
};

const handleLoad = () => {
  if (!props.tunnel) return;
  loading.value = true;
  send(ipcRouters.CLOUDFLARED.getConfig, { tunnelId: props.tunnel.id });
};

/** 校验失败时切换到对应 Tab，避免其他页签里的错误不可见 */
const revealInvalidField = async (fields?: Record<string, unknown>) => {
  const invalidField = formRef.value?.fields.find(
    field => fields?.[field.propString]
  );
  if (!invalidField) return;
  const tab = invalidField.$el?.closest<HTMLElement>("[data-cloudflared-tab]")
    ?.dataset.cloudflaredTab;
  if (tab) activeTab.value = tab;
  await nextTick();
  invalidField.$el?.scrollIntoView({ block: "center" });
  invalidField.$el
    ?.querySelector<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex="0"]'
    )
    ?.focus({ preventScroll: true });
};

const handleSubmit = useDebounceFn(() => {
  if (!formRef.value || !props.tunnel) return;
  formRef.value.validate(async (valid, fields) => {
    if (!valid) {
      await revealInvalidField(fields);
      return;
    }
    const data = _.cloneDeep(formData.value);
    data.tunnelId = props.tunnel!.id;
    data.token = data.token.trim();
    if (binarySource.value === "custom") {
      data.customCloudflaredPath = data.customCloudflaredPath.trim();
      data.cloudflaredVersion = null;
    } else {
      data.customCloudflaredPath = "";
    }
    saving.value = true;
    send(ipcRouters.CLOUDFLARED.saveConfig, {
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
    router.push({ name: "Download", query: { provider: "cloudflared" } });
  });
};

const handleOpenDashboard = () => {
  send(ipcRouters.SYSTEM.openUrl, { url: CLOUDFLARE_DASHBOARD_URL });
};

const handleDetectPath = () => {
  detectingPath.value = true;
  send(ipcRouters.CLOUDFLARED.detectPath);
};

const handleBrowse = () => {
  send(ipcRouters.SYSTEM.selectLocalFile, { name: "", extensions: [] });
};

const handleValidatePath = useDebounceFn(() => {
  const path = formData.value.customCloudflaredPath?.trim();
  if (!path) {
    detectedVersionInfo.value = "";
    return;
  }
  send(ipcRouters.CLOUDFLARED.validatePath, { path });
}, 300);

watch(
  () => [drawerVisible.value, props.tunnel?.id],
  ([open]) => {
    hydratingForm = true;
    formDirty.value = false;
    formRef.value?.clearValidate();
    detectedVersionInfo.value = "";
    if (open) {
      activeTab.value = "instance";
      formData.value = defaultFormData(props.tunnel?.id);
      formData.value.instanceName =
        tunnelName.value || props.tunnel?.name || "";
      formData.value.autoStart = props.tunnel?.autoStart ?? false;
      binarySource.value = "downloaded";
      frpcDesktopStore.refreshDownloadedVersion();
      handleLoad();
    }
  }
);

onMounted(() => {
  listenerCleanups.push(
    on(
      ipcRouters.CLOUDFLARED.getConfig,
      (data: CloudflaredSettings) => {
        if (!drawerVisible.value || data?.tunnelId !== props.tunnel?.id) {
          return;
        }
        hydratingForm = true;
        const { instanceName, autoStart } = formData.value;
        formData.value = {
          ...defaultFormData(data.tunnelId),
          ...data,
          instanceName,
          autoStart
        };
        checkAndResetVersion();
        binarySource.value = formData.value.customCloudflaredPath?.trim()
          ? "custom"
          : "downloaded";
        if (binarySource.value === "custom") handleValidatePath();
        loading.value = false;
        formDirty.value = false;
        nextTick(() => {
          hydratingForm = false;
        });
      },
      (_bizCode: string, message: string) => {
        loading.value = false;
        ElMessage({ type: "error", message });
      }
    )
  );

  listenerCleanups.push(
    on(
      ipcRouters.CLOUDFLARED.saveConfig,
      () => {
        saving.value = false;
        formDirty.value = false;
        ElMessage({
          type: "success",
          message: t("tunnel.message.saveSuccess")
        });
        tunnelStore.refreshTunnels();
      },
      (_bizCode: string, message: string) => {
        saving.value = false;
        ElMessage({ type: "error", message });
      }
    )
  );

  listenerCleanups.push(
    on(ipcRouters.CLOUDFLARED.detectPath, (data: any) => {
      detectingPath.value = false;
      if (data?.found && data.path) {
        formData.value.customCloudflaredPath = data.path;
        detectedVersionInfo.value = data.version ?? "";
        ElMessage({
          type: "success",
          message: `${t("tunnel.cloudflared.customPath.autoDetectSuccess")} ${data.path}`
        });
        formRef.value?.validateField("customCloudflaredPath");
      } else {
        ElMessage({
          type: "warning",
          message: t("tunnel.cloudflared.customPath.autoDetectNotFound")
        });
      }
    })
  );

  listenerCleanups.push(
    on(ipcRouters.CLOUDFLARED.validatePath, (data: any) => {
      detectedVersionInfo.value = data?.valid ? data.version || "OK" : "";
    })
  );

  listenerCleanups.push(
    on(ipcRouters.SYSTEM.selectLocalFile, data => {
      // frpc 配置抽屉和代理页也会选择文件，只处理本抽屉打开时的选择
      if (!drawerVisible.value || data?.canceled) return;
      formData.value.customCloudflaredPath = data.path as string;
      handleValidatePath();
    })
  );

  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  listenerCleanups.splice(0).forEach(off => off());
});
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    size="min(760px, 92%)"
    class="config-drawer"
    :before-close="handleBeforeClose"
  >
    <template #header="{ titleId, titleClass }">
      <h2 :id="titleId" :class="titleClass" :title="tunnelName">
        {{ t("tunnel.config.title", { name: tunnelName }) }}
      </h2>
    </template>
    <div v-loading="loading" class="pr-2">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-position="right"
        label-width="130"
      >
        <el-tabs v-model="activeTab" class="config-tabs">
          <el-tab-pane name="instance" data-cloudflared-tab="instance">
            <template #label>
              <span class="config-tab-label">
                <IconifyIconOffline class="text-base" icon="settings" />
                {{ t("tunnel.cloudflared.tab.instance") }}
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

          <el-tab-pane name="tunnel" data-cloudflared-tab="tunnel">
            <template #label>
              <span class="config-tab-label">
                <IconifyIconOffline class="text-base" icon="cloud" />
                {{ t("tunnel.cloudflared.tab.tunnel") }}
              </span>
            </template>
            <div class="mb-4">
              <el-alert type="info" :closable="false" show-icon>
                <template #title>
                  <span class="leading-relaxed">{{
                    t("tunnel.cloudflared.intro")
                  }}</span>
                </template>
                <el-link
                  type="primary"
                  class="mt-1"
                  @click="handleOpenDashboard"
                >
                  {{ t("tunnel.cloudflared.openDashboard") }}
                  <IconifyIconOffline class="ml-1" icon="open-in-new" />
                </el-link>
              </el-alert>
            </div>
            <el-form-item
              :label="t('tunnel.cloudflared.token.label')"
              prop="token"
            >
              <el-input
                :model-value="formData.token"
                type="password"
                show-password
                autocomplete="off"
                :placeholder="t('tunnel.cloudflared.token.placeholder')"
                @update:model-value="handleTokenChange"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane name="client" data-cloudflared-tab="client">
            <template #label>
              <span class="config-tab-label">
                <IconifyIconOffline class="text-base" icon="terminal-rounded" />
                {{ t("tunnel.cloudflared.tab.client") }}
              </span>
            </template>
            <el-form-item :label="t('tunnel.cloudflared.source.label')">
              <el-radio-group v-model="binarySource">
                <el-radio-button value="downloaded">
                  {{ t("tunnel.cloudflared.source.downloaded") }}
                </el-radio-button>
                <el-radio-button value="custom">
                  {{ t("tunnel.cloudflared.source.custom") }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item
              v-if="binarySource === 'downloaded'"
              :label="t('tunnel.cloudflared.version.label')"
            >
              <el-select
                v-model="formData.cloudflaredVersion"
                class="w-full"
                clearable
                :placeholder="t('tunnel.cloudflared.version.placeholder')"
                :no-data-text="t('tunnel.cloudflared.version.empty')"
              >
                <el-option
                  v-for="v in frpcDesktopStore.downloadedCloudflaredVersions"
                  :key="v.githubReleaseId"
                  :label="v.name"
                  :value="v.githubReleaseId"
                />
              </el-select>
              <div
                class="flex flex-wrap gap-2 justify-between items-center mt-1 w-full"
              >
                <span class="text-xs text-text_color_secondary">
                  {{ t("tunnel.cloudflared.version.autoHint") }}
                </span>
                <span class="flex gap-2">
                  <el-link
                    type="primary"
                    @click="frpcDesktopStore.refreshDownloadedVersion()"
                  >
                    <IconifyIconOffline class="mr-1" icon="refresh-rounded" />
                    {{ t("config.button.manualRefresh") }}
                  </el-link>
                  <el-link type="primary" @click="handleGoToDownload">
                    <IconifyIconOffline class="mr-1" icon="download" />
                    {{ t("config.button.goToDownload") }}
                  </el-link>
                </span>
              </div>
            </el-form-item>
            <el-form-item
              v-else
              :label="t('tunnel.cloudflared.customPath.label')"
              prop="customCloudflaredPath"
            >
              <div class="flex flex-wrap gap-2 items-center w-full">
                <el-input
                  v-model="formData.customCloudflaredPath"
                  class="flex-1 min-w-[200px]"
                  clearable
                  :placeholder="t('tunnel.cloudflared.customPath.placeholder')"
                  @input="handleValidatePath"
                  @clear="handleValidatePath"
                />
                <el-button
                  :loading="detectingPath"
                  type="primary"
                  @click="handleDetectPath"
                >
                  <IconifyIconOffline class="mr-1" icon="refresh-rounded" />
                  {{ t("config.button.autoDetect") }}
                </el-button>
                <el-button @click="handleBrowse">
                  <IconifyIconOffline class="mr-1" icon="file-open-rounded" />
                  {{ t("config.button.browse") }}
                </el-button>
              </div>
              <div
                v-if="detectedVersionInfo"
                class="flex items-center mt-1 w-full text-xs text-text_color_secondary"
              >
                <span class="mr-1.5">
                  {{ t("tunnel.cloudflared.customPath.detectedVersion") }}:
                </span>
                <el-tag size="small" type="success">
                  {{ detectedVersionInfo }}
                </el-tag>
              </div>
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane name="advanced" data-cloudflared-tab="advanced">
            <template #label>
              <span class="config-tab-label">
                <IconifyIconOffline class="text-base" icon="tune-rounded" />
                {{ t("tunnel.cloudflared.tab.advanced") }}
              </span>
            </template>
            <el-form-item :label="t('tunnel.cloudflared.protocol.label')">
              <el-select v-model="formData.protocol" class="w-full">
                <el-option
                  value="auto"
                  :label="t('tunnel.cloudflared.protocol.auto')"
                />
                <el-option value="quic" label="QUIC" />
                <el-option value="http2" label="HTTP/2" />
              </el-select>
              <div class="mt-1 text-xs text-text_color_secondary">
                {{ t("tunnel.cloudflared.protocol.tips") }}
              </div>
            </el-form-item>
            <el-form-item :label="t('tunnel.cloudflared.edgeIpVersion.label')">
              <el-radio-group v-model="formData.edgeIpVersion">
                <el-radio-button value="auto">
                  {{ t("tunnel.cloudflared.edgeIpVersion.auto") }}
                </el-radio-button>
                <el-radio-button value="4">IPv4</el-radio-button>
                <el-radio-button value="6">IPv6</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item :label="t('tunnel.cloudflared.logLevel.label')">
              <el-select v-model="formData.logLevel" class="w-full">
                <el-option
                  v-for="level in logLevels"
                  :key="level"
                  :label="t(`logger.level.${level}`)"
                  :value="level"
                />
              </el-select>
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="handleBeforeClose(() => (drawerVisible = false))">
        <IconifyIconOffline class="mr-2" icon="cancel-presentation" />
        {{ t("common.close") }}
      </el-button>
      <el-button
        type="primary"
        :loading="saving"
        :title="t('config.button.saveWithShortcut')"
        @click="handleSubmit"
      >
        <IconifyIconOffline class="mr-2" icon="save-rounded" />
        {{ t("common.save") }}
      </el-button>
    </template>
  </el-drawer>
</template>
