<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import router from "@/router";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessageBox } from "element-plus";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";
defineComponent({
  name: "Home"
});

const frpcDesktopStore = useFrpcDesktopStore();
const loading = ref(false);
const now = ref(Date.now());
let uptimeTimer: ReturnType<typeof setInterval> | null = null;
const { t } = useI18n();
const listenerCleanups: Array<() => void> = [];
const overview = ref<FrpcHomeOverview | null>(null);

const refreshOverview = () => {
  send(ipcRouters.LAUNCH.getOverview);
};

const serverText = computed(() => {
  const o = overview.value;
  if (!o || !o.serverAddr) return "";
  return `${o.serverAddr}:${o.serverPort}`;
});

const frpcVersionText = computed(() => {
  const o = overview.value;
  if (!o) return "";
  if (o.customFrpcPath) return t("home.dashboard.customPath");
  return o.frpcVersion || t("home.dashboard.notSelected");
});

// Three-state status: "running" | "error" | "stopped"
const frpcStatus = computed(() => {
  if (!frpcDesktopStore.frpcProcessRunning) return "stopped";
  if (frpcDesktopStore.frpcConnectionError) return "error";
  return "running";
});

const handleStartFrpc = () => {
  send(ipcRouters.LAUNCH.launch);
};

const handleStopFrpc = () => {
  send(ipcRouters.LAUNCH.terminate);
};

const handleButtonClick = useDebounceFn(() => {
  loading.value = true;
  if (frpcDesktopStore.frpcProcessRunning) {
    handleStopFrpc();
  } else {
    handleStartFrpc();
  }
}, 300);

const uptime = computed(() => {
  const lastStartTime = frpcDesktopStore.frpcProcessLastStartTime;
  const uptime =
    frpcDesktopStore.frpcProcessRunning && lastStartTime > 0
      ? Math.max(0, now.value - lastStartTime) / 1000
      : 0;
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.ceil(uptime % 60);
  let result = "";
  if (days > 0) {
    result += t("home.uptime.days", { days });
  }
  if (hours > 0) {
    result += t("home.uptime.hours", { hours });
  }
  if (minutes > 0) {
    result += t("home.uptime.minutes", { minutes });
  }
  result += t("home.uptime.seconds", { seconds });
  return result;
});

// Reset loading whenever the running state changes (covers cases where the IPC
// reply is delayed or never arrives, e.g. macOS sudo/osascript flow).
watch(
  () => frpcDesktopStore.frpcProcessRunning,
  () => {
    loading.value = false;
    // 日志会在启动/停止后变化，稍等 frpc 写入后再刷新
    window.setTimeout(refreshOverview, 1500);
  }
);

onMounted(() => {
  listenerCleanups.push(
    on(ipcRouters.LAUNCH.getOverview, (data: FrpcHomeOverview) => {
      overview.value = data;
    })
  );
  refreshOverview();
  uptimeTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  listenerCleanups.push(
    on(
      ipcRouters.LAUNCH.launch,
      () => {
        frpcDesktopStore.refreshRunning();
        loading.value = false;
      },
      (bizCode: string, message: string) => {
        console.log("bizCode", bizCode);
        if (bizCode === "B1001") {
          ElMessageBox.alert(
            t("home.alert.configRequired.message"),
            t("home.alert.configRequired.title"),
            {
              confirmButtonText: t("home.alert.configRequired.confirm")
            }
          ).then(() => {
            router.replace({
              name: "Config"
            });
          });
        } else if (bizCode === "B1005") {
          ElMessageBox.alert(
            t("home.alert.versionNotFound.message"),
            t("home.alert.versionNotFound.title"),
            {
              confirmButtonText: t("home.alert.versionNotFound.confirm")
            }
          ).then(() => {
            router.replace({
              name: "Config"
            });
          });
        } else if (bizCode === "B1006") {
          ElMessageBox.alert(
            t("home.alert.webServerPortInUse.message"),
            t("home.alert.webServerPortInUse.title"),
            {
              confirmButtonText: t("home.alert.webServerPortInUse.confirm")
            }
          ).then(() => {
            router.replace({
              name: "Config"
            });
          });
        }
        loading.value = false;
      }
    )
  );

  listenerCleanups.push(
    on(ipcRouters.LAUNCH.terminate, () => {
      frpcDesktopStore.refreshRunning();
      loading.value = false;
    })
  );
});

onUnmounted(() => {
  if (uptimeTimer) {
    clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
  listenerCleanups.splice(0).forEach(off => off());
});
</script>

<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <div class="flex flex-col gap-3 pr-1 pb-1">
        <section class="p-5 app-panel status-card" :class="`is-${frpcStatus}`">
          <div class="status-icon" aria-hidden="true">
            <IconifyIconOffline
              :icon="
                frpcStatus === 'running'
                  ? 'check-circle-rounded'
                  : frpcStatus === 'error'
                    ? 'warningRounded'
                    : 'power-settings-new-rounded'
              "
            />
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="status-title">
              {{
                $t("home.status.frpcStatus", {
                  status:
                    frpcStatus === "running"
                      ? $t("home.status.running")
                      : frpcStatus === "error"
                        ? $t("home.status.connectionError")
                        : $t("home.status.disconnected")
                })
              }}
            </h2>
            <p class="mt-1 text-sm truncate text-text_color_secondary">
              <template v-if="serverText">
                {{ serverText }} · frpc {{ frpcVersionText }}
              </template>
              <template v-else>
                {{ $t("home.dashboard.notConfigured") }}
              </template>
            </p>
            <p
              v-if="frpcStatus === 'running'"
              class="mt-1 text-sm text-text_color_secondary"
            >
              {{ $t("home.status.runningTime") }}
              <span class="font-semibold tabular-nums text-primary">{{
                uptime
              }}</span>
            </p>
            <p
              v-else-if="frpcStatus === 'error'"
              class="mt-1 text-sm break-all line-clamp-2 status-error"
              :title="frpcDesktopStore.frpcConnectionError ?? ''"
            >
              {{ frpcDesktopStore.frpcConnectionError }}
            </p>
          </div>
          <div class="flex gap-2 items-center">
            <el-button
              v-if="frpcStatus !== 'stopped'"
              text
              @click="$router.push({ name: 'Logger' })"
            >
              {{ $t("home.button.viewLog") }}
            </el-button>
            <el-button
              size="large"
              :type="frpcDesktopStore.frpcProcessRunning ? 'danger' : 'primary'"
              :plain="frpcDesktopStore.frpcProcessRunning"
              :loading="loading"
              @click="handleButtonClick"
            >
              <template #icon>
                <IconifyIconOffline
                  :icon="
                    frpcDesktopStore.frpcProcessRunning
                      ? 'stop-circle-outline'
                      : 'play-arrow-rounded'
                  "
                />
              </template>
              {{
                frpcDesktopStore.frpcProcessRunning
                  ? $t("home.button.stop")
                  : $t("home.button.start")
              }}
            </el-button>
          </div>
        </section>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            class="text-left stat-card app-panel is-clickable"
            @click="$router.push({ name: 'Proxy' })"
          >
            <span class="stat-label">
              <IconifyIconOffline icon="cloud" />
              {{ $t("home.dashboard.proxies") }}
            </span>
            <span class="stat-value">{{ overview?.proxyEnabled ?? "-" }}</span>
            <span class="stat-hint">
              {{
                $t("home.dashboard.proxiesValue", {
                  enabled: overview?.proxyEnabled ?? 0,
                  total: overview?.proxyTotal ?? 0
                })
              }}
            </span>
          </button>
          <div class="stat-card app-panel">
            <span class="stat-label">
              <IconifyIconOffline icon="dns-outline" />
              {{ $t("home.dashboard.server") }}
            </span>
            <span class="truncate stat-value is-text" :title="serverText">
              {{ overview?.serverAddr || "-" }}
            </span>
            <span class="stat-hint">
              {{
                overview?.serverAddr
                  ? $t("home.dashboard.port", { port: overview.serverPort })
                  : ""
              }}
            </span>
          </div>
          <div class="stat-card app-panel">
            <span class="stat-label">
              <IconifyIconOffline icon="lan-outline" />
              {{ $t("home.dashboard.protocol") }}
            </span>
            <span class="uppercase stat-value is-text">
              {{ overview?.protocol || "-" }}
            </span>
            <span class="stat-hint">
              {{
                overview?.tlsEnable
                  ? $t("home.dashboard.tlsOn")
                  : $t("home.dashboard.tlsOff")
              }}
            </span>
          </div>
          <button
            type="button"
            class="text-left stat-card app-panel is-clickable"
            @click="$router.push({ name: 'Download' })"
          >
            <span class="stat-label">
              <IconifyIconOffline icon="download" />
              {{ $t("home.dashboard.frpcVersion") }}
            </span>
            <span class="truncate stat-value is-text">
              {{ frpcVersionText || "-" }}
            </span>
            <span class="stat-hint">
              {{ overview?.customFrpcPath ? "" : $t("home.dashboard.manage") }}
            </span>
          </button>
        </section>

        <section class="p-4 app-panel">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm font-semibold">
              {{ $t("home.dashboard.recentLogs") }}
            </h3>
            <el-button
              text
              type="primary"
              size="small"
              @click="$router.push({ name: 'Logger' })"
            >
              {{ $t("home.dashboard.viewAll") }}
              <IconifyIconOffline class="ml-1" icon="arrow-forward-rounded" />
            </el-button>
          </div>
          <div
            v-if="overview?.recentLogs?.length"
            class="recent-logs"
            role="log"
          >
            <div
              v-for="(line, index) in overview.recentLogs"
              :key="index"
              class="truncate"
              :title="line"
            >
              {{ line }}
            </div>
          </div>
          <p v-else class="py-3 text-sm text-text_color_secondary">
            {{ $t("home.dashboard.noLogs") }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.status-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  .status-icon {
    width: 52px;
    height: 52px;
    flex: none;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
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

  .status-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .status-error {
    color: var(--el-color-warning);
  }
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 14px 16px;
  color: inherit;

  &.is-clickable {
    cursor: pointer;
    transition: border-color 0.15s ease;

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 1px;
    }
  }

  .stat-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;

    &.is-text {
      font-size: 17px;
    }
  }

  .stat-hint {
    min-height: 18px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.recent-logs {
  font-family: var(--app-mono);
  font-size: 12px;
  line-height: 1.9;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 8px 12px;
  user-select: text;
  -webkit-user-select: text;
}
</style>
