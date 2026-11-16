<script lang="ts" setup>
import { useDebounceFn } from "@vueuse/core";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import router from "@/router";
import { useTunnelStore } from "@/store/tunnel";
import { on, request, send } from "@/utils/ipcUtils";
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";
import CloudflaredConfigDrawer from "@/views/config/CloudflaredConfigDrawer.vue";
import ConfigDrawer from "@/views/config/ConfigDrawer.vue";
import TunnelLogDrawer from "./TunnelLogDrawer.vue";
import { useBulkLaunch, useTunnelStatus } from "./useTunnelStatus";

defineOptions({
  name: "TunnelPage"
});

const { t } = useI18n();
const tunnelStore = useTunnelStore();
const { statusKey, statusLabel, statusIcon, uptimeText } = useTunnelStatus();
const { bulk, startAll, stopAll } = useBulkLaunch();
const listenerCleanups: Array<() => void> = [];
/** 正在启动/停止的实例，防止重复点击 */
const pending = reactive<Record<string, boolean>>({});
const logDrawer = reactive({
  visible: false,
  tunnel: null as TunnelSummary | null
});
type ConfigTarget = Pick<
  TunnelSummary,
  "id" | "name" | "provider" | "autoStart"
>;
const configDrawer = reactive({
  visible: false,
  tunnel: null as ConfigTarget | null
});
const cloudflaredDrawer = reactive({
  visible: false,
  tunnel: null as ConfigTarget | null
});

const handleToggle = (tunnel: TunnelSummary) => {
  if (pending[tunnel.id]) return;
  pending[tunnel.id] = true;
  if (tunnelStore.statusOf(tunnel.id).running) {
    send(ipcRouters.LAUNCH.terminate, { tunnelId: tunnel.id });
  } else {
    send(ipcRouters.LAUNCH.launch, { tunnelId: tunnel.id });
  }
};

const goToProxy = (tunnelId: string) => {
  tunnelStore.setCurrentTunnel(tunnelId);
  router.push({ name: "Proxy" });
};

const openConfig = (tunnel: ConfigTarget) => {
  const drawer =
    tunnel.provider === "cloudflared" ? cloudflaredDrawer : configDrawer;
  drawer.tunnel = tunnel;
  drawer.visible = true;
};

const openLog = (tunnel: TunnelSummary) => {
  logDrawer.tunnel = tunnel;
  logDrawer.visible = true;
};

const handleExportConfig = useDebounceFn((tunnel: TunnelSummary) => {
  send(ipcRouters.SERVER.exportConfig, { tunnelId: tunnel.id });
}, 300);

const promptTunnelName = (title: string, inputValue = "") =>
  ElMessageBox.prompt(t("tunnel.prompt.nameLabel"), title, {
    inputValue,
    inputPlaceholder: t("tunnel.prompt.namePlaceholder"),
    inputValidator: (value: string) => {
      const name = (value ?? "").trim();
      return (
        (name.length > 0 && name.length <= 64) || t("tunnel.prompt.nameInvalid")
      );
    },
    confirmButtonText: t("tunnel.prompt.confirm"),
    cancelButtonText: t("tunnel.prompt.cancel")
  }).then(({ value }) => value.trim());

const importing = ref(false);
const handleImportConfig = async () => {
  if (importing.value) return;
  importing.value = true;
  try {
    const name = await promptTunnelName(t("tunnel.prompt.importTitle"));
    const response = await request<TomlImportResult>(
      ipcRouters.TUNNEL.importTomlConfig,
      { name }
    );
    if (response.bizCode !== "A1000") throw new Error(response.message);
    const result = response.data;
    if (!result || result.canceled !== false) return;
    tunnelStore.setCurrentTunnel(result.tunnel.id);
    tunnelStore.refreshTunnels();
    openConfig(result.tunnel);
    ElMessage.success(t("tunnel.message.importSuccess"));
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(
        t("tunnel.message.importFailed", {
          reason: error instanceof Error ? error.message : String(error)
        })
      );
    }
  } finally {
    importing.value = false;
  }
};

const handleCreate = (provider: TunnelProvider) => {
  promptTunnelName(
    `${t("tunnel.prompt.createTitle")} · ${t(`tunnel.provider.${provider}`)}`
  )
    .then(name => send(ipcRouters.TUNNEL.create, { name, provider }))
    .catch(() => {});
};

const deleteDialog = reactive({
  visible: false,
  tunnel: null as TunnelSummary | null,
  pending: false
});

const handleDelete = (tunnel: TunnelSummary) => {
  if (deleteDialog.pending) return;
  deleteDialog.tunnel = tunnel;
  deleteDialog.visible = true;
};

const confirmDelete = () => {
  if (!deleteDialog.tunnel || deleteDialog.pending) return;
  deleteDialog.pending = true;
  send(ipcRouters.TUNNEL.delete, { tunnelId: deleteDialog.tunnel.id });
};

const showLaunchError = (
  tunnelId: string | undefined,
  bizCode: string,
  message: string
) => {
  const target: Record<string, { key: string; route: "Config" | "Proxy" }> = {
    B1001: { key: "configRequired", route: "Config" },
    B1005: { key: "versionNotFound", route: "Config" },
    B1006: { key: "webServerPortInUse", route: "Config" },
    B1007: { key: "visitorPortInUse", route: "Proxy" }
  };
  const id = tunnelId || tunnelStore.currentTunnelId;
  const hit = target[bizCode];
  if (!hit) {
    ElMessage({ type: "error", message });
    return;
  }
  ElMessageBox.alert(
    t(`home.alert.${hit.key}.message`),
    t(`home.alert.${hit.key}.title`),
    {
      type: "warning",
      confirmButtonText: t(`home.alert.${hit.key}.confirm`)
    }
  ).then(() => {
    if (hit.route === "Proxy") {
      goToProxy(id);
      return;
    }
    const tunnel = tunnelStore.tunnels.find(item => item.id === id);
    if (tunnel) openConfig(tunnel);
  });
};

onMounted(() => {
  tunnelStore.refreshTunnels();
  tunnelStore.refreshStatuses();

  listenerCleanups.push(
    on(ipcRouters.SERVER.exportConfig, data => {
      const { canceled, path } = data;
      if (!canceled) {
        ElMessageBox.alert(
          t("config.alert.exportConfigSuccess.message", { path }),
          t("config.alert.exportConfigSuccess.title"),
          { type: "success" }
        );
      }
    })
  );
  listenerCleanups.push(
    on(
      ipcRouters.LAUNCH.launch,
      (data: TunnelStatus) => {
        tunnelStore.applyStatus(data);
        if (data?.tunnelId) pending[data.tunnelId] = false;
      },
      (bizCode: string, message: string, data?: { tunnelId?: string }) => {
        if (data?.tunnelId) pending[data.tunnelId] = false;
        showLaunchError(data?.tunnelId, bizCode, message);
      }
    )
  );
  listenerCleanups.push(
    on(ipcRouters.LAUNCH.terminate, (data: { tunnelId: string }) => {
      if (data?.tunnelId) pending[data.tunnelId] = false;
      tunnelStore.refreshStatuses();
    })
  );
  listenerCleanups.push(
    on(ipcRouters.TUNNEL.create, (data: Tunnel) => {
      ElMessage({
        type: "success",
        message: t("tunnel.message.createSuccess")
      });
      tunnelStore.refreshTunnels();
      // 新实例还没有服务端配置，直接打开它的配置
      openConfig(data);
    })
  );
  listenerCleanups.push(
    on(
      ipcRouters.TUNNEL.delete,
      () => {
        deleteDialog.pending = false;
        deleteDialog.visible = false;
        ElMessage({
          type: "success",
          message: t("tunnel.message.deleteSuccess")
        });
        tunnelStore.refreshTunnels();
        tunnelStore.refreshStatuses();
      },
      (_bizCode, message) => {
        deleteDialog.pending = false;
        ElMessage({ type: "error", message });
      }
    )
  );
});

onUnmounted(() => {
  listenerCleanups.splice(0).forEach(off => off());
});
</script>

<template>
  <div class="main">
    <breadcrumb>
      <template v-if="tunnelStore.hasMultiple">
        <el-button :loading="bulk.start" @click="startAll">
          <template #icon>
            <IconifyIconOffline icon="play-arrow-rounded" />
          </template>
          {{ t("tunnel.button.startAll") }}
        </el-button>
        <el-button
          :loading="bulk.stop"
          :disabled="!tunnelStore.anyRunning"
          @click="stopAll"
        >
          <template #icon>
            <IconifyIconOffline icon="stop-circle-outline" />
          </template>
          {{ t("tunnel.button.stopAll") }}
        </el-button>
      </template>
      <el-button
        :loading="importing"
        :disabled="importing"
        @click="handleImportConfig"
      >
        <template #icon>
          <IconifyIconOffline icon="file-open-rounded" />
        </template>
        {{ t("tunnel.button.importToml") }}
      </el-button>
      <el-dropdown trigger="click" @command="handleCreate">
        <el-button type="primary">
          <template #icon>
            <IconifyIconOffline icon="add" />
          </template>
          {{ t("tunnel.button.create") }}
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="provider in ['frpc', 'cloudflared'] as const"
              :key="provider"
              :command="provider"
            >
              <IconifyIconOffline
                class="mr-2 text-lg"
                :icon="provider === 'frpc' ? 'lan-outline' : 'public'"
              />
              <span class="flex flex-col py-1 leading-snug">
                <span class="font-medium">
                  {{ t(`tunnel.provider.${provider}`) }}
                </span>
                <span class="text-xs text-text_color_secondary">
                  {{ t(`tunnel.provider.${provider}Description`) }}
                </span>
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </breadcrumb>
    <div v-loading="!tunnelStore.loaded" class="app-container-breadcrumb">
      <div
        v-if="tunnelStore.loaded && tunnelStore.tunnels.length === 0"
        class="flex justify-center items-center p-4 w-full h-full app-panel"
      >
        <el-empty :description="t('tunnel.empty')">
          <div class="flex flex-wrap gap-2 justify-center">
            <el-button
              v-for="provider in ['frpc', 'cloudflared'] as const"
              :key="provider"
              :type="provider === 'frpc' ? 'primary' : 'default'"
              @click="handleCreate(provider)"
            >
              <template #icon>
                <IconifyIconOffline icon="add" />
              </template>
              {{ t("tunnel.button.create") }} ·
              {{ t(`tunnel.provider.${provider}`) }}
            </el-button>
          </div>
        </el-empty>
      </div>
      <section
        v-else
        class="grid gap-3 pr-1 pb-1 tunnel-grid"
        :class="{ 'is-multiple': tunnelStore.hasMultiple }"
      >
        <article
          v-for="tunnel in tunnelStore.tunnels"
          :key="tunnel.id"
          class="app-panel tunnel-card"
          :class="`is-${statusKey(tunnel.id)}`"
        >
          <header class="flex gap-3 items-center">
            <div class="status-icon" aria-hidden="true">
              <IconifyIconOffline :icon="statusIcon(tunnel.id)" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex gap-2 items-center min-w-0">
                <h2 class="tunnel-name" :title="tunnel.name">
                  {{ tunnel.name }}
                </h2>
                <el-tag size="small" type="info" effect="plain">
                  {{ t(`tunnel.provider.${tunnel.provider}`) }}
                </el-tag>
              </div>
              <p class="mt-1 text-sm text-text_color_secondary">
                {{ statusLabel(tunnel.id) }}
                <template v-if="statusKey(tunnel.id) === 'running'">
                  · {{ t("home.status.runningTime") }}
                  <span class="font-semibold tabular-nums text-primary">
                    {{ uptimeText(tunnel.id) }}
                  </span>
                </template>
              </p>
            </div>
            <el-button
              :type="
                tunnelStore.statusOf(tunnel.id).running ? 'danger' : 'primary'
              "
              :plain="tunnelStore.statusOf(tunnel.id).running"
              :loading="!!pending[tunnel.id]"
              @click="handleToggle(tunnel)"
            >
              <template #icon>
                <IconifyIconOffline
                  :icon="
                    tunnelStore.statusOf(tunnel.id).running
                      ? 'stop-circle-outline'
                      : 'play-arrow-rounded'
                  "
                />
              </template>
              {{
                tunnelStore.statusOf(tunnel.id).running
                  ? t("home.button.stop")
                  : t("home.button.start")
              }}
            </el-button>
          </header>
          <dl v-if="tunnel.provider === 'cloudflared'" class="tunnel-meta">
            <dt>{{ t("tunnel.meta.connector") }}</dt>
            <dd :class="{ 'text-text_color_secondary': !tunnel.configured }">
              {{
                tunnel.configured
                  ? t("tunnel.meta.tokenConfigured")
                  : t("tunnel.meta.tokenMissing")
              }}
            </dd>
            <dt>{{ t("tunnel.meta.routes") }}</dt>
            <dd>{{ t("tunnel.meta.routesInDashboard") }}</dd>
          </dl>
          <dl v-else class="tunnel-meta">
            <dt>{{ t("home.dashboard.server") }}</dt>
            <dd
              class="is-mono"
              :title="
                tunnel.serverAddr
                  ? `${tunnel.serverAddr}:${tunnel.serverPort}`
                  : ''
              "
            >
              {{
                tunnel.serverAddr
                  ? `${tunnel.serverAddr}:${tunnel.serverPort}`
                  : t("home.dashboard.notConfigured")
              }}
            </dd>
            <dt>{{ t("home.dashboard.proxies") }}</dt>
            <dd>
              {{
                t("home.dashboard.proxiesValue", {
                  enabled: tunnel.proxyEnabled,
                  total: tunnel.proxyTotal
                })
              }}
            </dd>
          </dl>
          <p
            v-if="statusKey(tunnel.id) === 'error'"
            class="mb-2 text-sm break-all line-clamp-2 status-error"
            :title="tunnelStore.statusOf(tunnel.id).connectionError ?? ''"
          >
            {{ tunnelStore.statusOf(tunnel.id).connectionError }}
          </p>
          <footer class="tunnel-card-actions">
            <el-button text size="small" @click="openConfig(tunnel)">
              <template #icon>
                <IconifyIconOffline icon="tune-rounded" />
              </template>
              {{ t("tunnel.button.config") }}
            </el-button>
            <el-button
              v-if="tunnel.provider === 'frpc'"
              text
              size="small"
              @click="goToProxy(tunnel.id)"
            >
              <template #icon>
                <IconifyIconOffline icon="cloud" />
              </template>
              {{ t("tunnel.button.proxies") }}
            </el-button>
            <el-button text size="small" @click="openLog(tunnel)">
              <template #icon>
                <IconifyIconOffline icon="file-copy-sharp" />
              </template>
              {{ t("tunnel.button.logs") }}
            </el-button>
            <el-button
              v-if="tunnel.provider === 'frpc'"
              text
              size="small"
              :aria-label="t('config.button.exportConfig')"
              :title="t('config.button.exportConfig')"
              @click="handleExportConfig(tunnel)"
            >
              <template #icon>
                <IconifyIconOffline icon="file-save-rounded" />
              </template>
              {{ t("config.button.exportConfig") }}
            </el-button>
            <el-button
              text
              type="danger"
              size="small"
              @click="handleDelete(tunnel)"
            >
              <template #icon>
                <IconifyIconOffline icon="delete-rounded" />
              </template>
              {{ t("tunnel.button.delete") }}
            </el-button>
          </footer>
        </article>
      </section>
    </div>
    <el-dialog
      v-model="deleteDialog.visible"
      :title="t('tunnel.delete.title')"
      width="440px"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="!deleteDialog.pending"
      :show-close="!deleteDialog.pending"
    >
      <template #header="{ titleId, titleClass }">
        <div class="flex gap-3 items-center pr-6">
          <span class="delete-dialog-icon" aria-hidden="true">
            <IconifyIconOffline icon="delete-rounded" />
          </span>
          <h2 :id="titleId" :class="titleClass" class="font-semibold">
            {{ t("tunnel.delete.title") }}
          </h2>
        </div>
      </template>
      <div v-if="deleteDialog.tunnel" class="flex flex-col gap-4">
        <div class="delete-dialog-target">
          <IconifyIconOffline
            class="flex-none text-xl text-text_color_secondary"
            :icon="
              deleteDialog.tunnel.provider === 'frpc' ? 'lan-outline' : 'public'
            "
            aria-hidden="true"
          />
          <span class="flex-1 min-w-0 font-semibold break-all">
            {{ deleteDialog.tunnel.name }}
          </span>
          <el-tag size="small" type="info" effect="plain" class="flex-none">
            {{ t(`tunnel.provider.${deleteDialog.tunnel.provider}`) }}
          </el-tag>
        </div>
        <p class="delete-dialog-description">
          {{
            t(
              deleteDialog.tunnel.provider === "frpc"
                ? "tunnel.delete.frpcDescription"
                : "tunnel.delete.cloudflaredDescription"
            )
          }}
        </p>
        <p class="delete-dialog-warning">
          {{ t("tunnel.delete.irreversible") }}
        </p>
      </div>
      <template #footer>
        <div class="flex flex-wrap gap-2 justify-end delete-dialog-actions">
          <el-button
            :disabled="deleteDialog.pending"
            @click="deleteDialog.visible = false"
          >
            {{ t("tunnel.delete.cancel") }}
          </el-button>
          <el-button
            type="danger"
            :loading="deleteDialog.pending"
            @click="confirmDelete"
          >
            {{ t("tunnel.delete.confirm") }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <TunnelLogDrawer v-model="logDrawer.visible" :tunnel="logDrawer.tunnel" />
    <ConfigDrawer
      v-model="configDrawer.visible"
      :tunnel="configDrawer.tunnel"
    />
    <CloudflaredConfigDrawer
      v-model="cloudflaredDrawer.visible"
      :tunnel="cloudflaredDrawer.tunnel"
    />
  </div>
</template>

<style scoped lang="scss">
.delete-dialog-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--app-radius);
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  font-size: 24px;
}

.delete-dialog-target {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  user-select: text;
}

.delete-dialog-description {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.delete-dialog-warning {
  color: var(--el-color-danger);
  font-size: 12px;
  font-weight: 500;
}

.delete-dialog-actions {
  :deep(.el-button) {
    margin-left: 0;
  }
}

.tunnel-grid {
  grid-template-columns: minmax(0, 1fr);

  &.is-multiple {
    @media (min-width: 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

.tunnel-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 16px 8px;
  transition: border-color 0.15s ease;

  .status-icon {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
  }

  &.is-running .status-icon {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }

  &.is-error .status-icon {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }

  .tunnel-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .status-error {
    color: var(--el-color-warning);
  }
}

.tunnel-meta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 4px;
  margin: 12px 0 10px;
  font-size: 12px;

  dt {
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  dd {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--el-text-color-regular);

    &.is-mono {
      font-family: var(--app-mono);
    }
  }
}

.tunnel-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--app-border);

  :deep(.el-button) {
    margin-left: 0;
  }
}
</style>
