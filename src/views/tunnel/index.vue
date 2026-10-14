<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import router from "@/router";
import { DEFAULT_TUNNEL_ID, useTunnelStore } from "@/store/tunnel";
import { on, send } from "@/utils/ipcUtils";
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";
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
const lastUpdateAction = ref<"rename" | "autoStartOn" | "autoStartOff">(
  "rename"
);

const handleToggle = (tunnel: TunnelSummary) => {
  if (pending[tunnel.id]) return;
  pending[tunnel.id] = true;
  if (tunnelStore.statusOf(tunnel.id).running) {
    send(ipcRouters.LAUNCH.terminate, { tunnelId: tunnel.id });
  } else {
    send(ipcRouters.LAUNCH.launch, { tunnelId: tunnel.id });
  }
};

const goTo = (tunnelId: string, name: "Config" | "Proxy") => {
  tunnelStore.setCurrentTunnel(tunnelId);
  router.push({ name });
};

const openLog = (tunnel: TunnelSummary) => {
  logDrawer.tunnel = tunnel;
  logDrawer.visible = true;
};

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

const handleCreate = () => {
  promptTunnelName(t("tunnel.prompt.createTitle"))
    .then(name => send(ipcRouters.TUNNEL.create, { name, provider: "frpc" }))
    .catch(() => {});
};

const handleCommand = (tunnel: TunnelSummary, command: string) => {
  if (command === "rename") {
    promptTunnelName(t("tunnel.prompt.renameTitle"), tunnel.name)
      .then(name => {
        lastUpdateAction.value = "rename";
        send(ipcRouters.TUNNEL.update, { tunnelId: tunnel.id, name });
      })
      .catch(() => {});
  } else if (command === "autoStart") {
    lastUpdateAction.value = tunnel.autoStart ? "autoStartOff" : "autoStartOn";
    send(ipcRouters.TUNNEL.update, {
      tunnelId: tunnel.id,
      autoStart: !tunnel.autoStart
    });
  } else if (command === "delete") {
    ElMessageBox.confirm(
      t("tunnel.delete.message", { name: tunnel.name }),
      t("tunnel.delete.title"),
      {
        type: "warning",
        confirmButtonText: t("tunnel.delete.confirm"),
        confirmButtonClass: "el-button--danger",
        cancelButtonText: t("tunnel.delete.cancel")
      }
    )
      .then(() => send(ipcRouters.TUNNEL.delete, { tunnelId: tunnel.id }))
      .catch(() => {});
  }
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
  const hit = target[bizCode];
  if (!hit) {
    ElMessage({ type: "error", message });
    return;
  }
  ElMessageBox.alert(
    t(`home.alert.${hit.key}.message`),
    t(`home.alert.${hit.key}.title`),
    { confirmButtonText: t(`home.alert.${hit.key}.confirm`) }
  ).then(() => {
    goTo(tunnelId || tunnelStore.currentTunnelId, hit.route);
  });
};

onMounted(() => {
  tunnelStore.refreshTunnels();
  tunnelStore.refreshStatuses();

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
      // 新实例还没有服务端配置，直接进入它的配置页
      goTo(data.id, "Config");
    })
  );
  listenerCleanups.push(
    on(ipcRouters.TUNNEL.update, () => {
      const messageKey =
        lastUpdateAction.value === "rename"
          ? "renameSuccess"
          : lastUpdateAction.value;
      ElMessage({
        type: "success",
        message: t(`tunnel.message.${messageKey}`)
      });
      tunnelStore.refreshTunnels();
    })
  );
  listenerCleanups.push(
    on(ipcRouters.TUNNEL.delete, () => {
      ElMessage({
        type: "success",
        message: t("tunnel.message.deleteSuccess")
      });
      tunnelStore.refreshTunnels();
      tunnelStore.refreshStatuses();
    })
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
      <el-button type="primary" @click="handleCreate">
        <template #icon>
          <IconifyIconOffline icon="add" />
        </template>
        {{ t("tunnel.button.create") }}
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb">
      <section
        v-loading="!tunnelStore.loaded"
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
                  {{ tunnel.provider }}
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
          <dl class="tunnel-meta">
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
            <el-button text size="small" @click="goTo(tunnel.id, 'Config')">
              <template #icon>
                <IconifyIconOffline icon="tune-rounded" />
              </template>
              {{ t("tunnel.button.config") }}
            </el-button>
            <el-button text size="small" @click="goTo(tunnel.id, 'Proxy')">
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
            <el-dropdown
              class="ml-auto"
              trigger="click"
              @command="(command: string) => handleCommand(tunnel, command)"
            >
              <el-button
                text
                size="small"
                :aria-label="t('tunnel.button.more')"
                :title="t('tunnel.button.more')"
              >
                <IconifyIconOffline icon="more-horiz" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">
                    <IconifyIconOffline class="mr-1" icon="edit" />
                    {{ t("tunnel.button.rename") }}
                  </el-dropdown-item>
                  <el-dropdown-item
                    command="autoStart"
                    :title="t('tunnel.autoStartHint')"
                  >
                    <IconifyIconOffline
                      class="mr-1"
                      :icon="tunnel.autoStart ? 'toggle-on' : 'toggle-off'"
                    />
                    {{ t("tunnel.autoStart") }}
                  </el-dropdown-item>
                  <el-dropdown-item
                    command="delete"
                    divided
                    :disabled="tunnel.id === DEFAULT_TUNNEL_ID"
                    :title="
                      tunnel.id === DEFAULT_TUNNEL_ID
                        ? t('tunnel.defaultHint')
                        : ''
                    "
                  >
                    <IconifyIconOffline class="mr-1" icon="delete-rounded" />
                    {{ t("tunnel.button.delete") }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </footer>
        </article>
      </section>
    </div>
    <TunnelLogDrawer v-model="logDrawer.visible" :tunnel="logDrawer.tunnel" />
  </div>
</template>

<style scoped lang="scss">
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
