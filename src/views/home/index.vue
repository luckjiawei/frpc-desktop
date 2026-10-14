<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { useTunnelStore } from "@/store/tunnel";
import { computed, defineComponent, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBulkLaunch, useTunnelStatus } from "@/views/tunnel/useTunnelStatus";

defineComponent({
  name: "Home"
});

// 仪表盘只做全局概览；实例的启停、配置和日志在“实例”页面管理
const { t } = useI18n();
const tunnelStore = useTunnelStore();
const frpcDesktopStore = useFrpcDesktopStore();
const { statusKey, statusLabel, uptimeText } = useTunnelStatus();
const { bulk, startAll, stopAll } = useBulkLaunch();

const summary = computed(() => {
  const tunnels = tunnelStore.tunnels;
  return {
    total: tunnels.length,
    running: tunnels.filter(item => statusKey(item.id) !== "stopped").length,
    errors: tunnels.filter(item => statusKey(item.id) === "error").length,
    proxyEnabled: tunnels.reduce((sum, item) => sum + item.proxyEnabled, 0),
    proxyTotal: tunnels.reduce((sum, item) => sum + item.proxyTotal, 0),
    versions: frpcDesktopStore.downloadedVersions.length
  };
});

const statusTagType = (tunnelId: string) => {
  const key = statusKey(tunnelId);
  return key === "running" ? "success" : key === "error" ? "warning" : "info";
};

const startLabel = computed(() =>
  tunnelStore.hasMultiple ? t("tunnel.button.startAll") : t("home.button.start")
);
const stopLabel = computed(() =>
  tunnelStore.hasMultiple ? t("tunnel.button.stopAll") : t("home.button.stop")
);

onMounted(() => {
  tunnelStore.refreshTunnels();
  tunnelStore.refreshStatuses();
  frpcDesktopStore.refreshDownloadedVersion();
});
</script>

<template>
  <div class="main">
    <breadcrumb>
      <el-button
        v-if="tunnelStore.anyRunning"
        type="danger"
        plain
        :loading="bulk.stop"
        @click="stopAll"
      >
        <template #icon>
          <IconifyIconOffline icon="stop-circle-outline" />
        </template>
        {{ stopLabel }}
      </el-button>
      <el-button v-else type="primary" :loading="bulk.start" @click="startAll">
        <template #icon>
          <IconifyIconOffline icon="play-arrow-rounded" />
        </template>
        {{ startLabel }}
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb">
      <div class="flex flex-col gap-3 pr-1 pb-1">
        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            class="text-left stat-card app-panel is-clickable"
            @click="$router.push({ name: 'Tunnel' })"
          >
            <span class="stat-label">
              <IconifyIconOffline icon="rocket-launch-rounded" />
              {{ t("home.dashboard.instances") }}
            </span>
            <span class="stat-value">{{ summary.running }}</span>
            <span class="stat-hint">
              {{ t("home.dashboard.instancesHint", { total: summary.total }) }}
            </span>
          </button>
          <button
            type="button"
            class="text-left stat-card app-panel is-clickable"
            @click="$router.push({ name: 'Proxy' })"
          >
            <span class="stat-label">
              <IconifyIconOffline icon="cloud" />
              {{ t("home.dashboard.proxies") }}
            </span>
            <span class="stat-value">{{ summary.proxyEnabled }}</span>
            <span class="stat-hint">
              {{
                t("home.dashboard.proxiesValue", {
                  enabled: summary.proxyEnabled,
                  total: summary.proxyTotal
                })
              }}
            </span>
          </button>
          <button
            type="button"
            class="text-left stat-card app-panel is-clickable"
            :class="{ 'is-warning': summary.errors > 0 }"
            @click="$router.push({ name: 'Tunnel' })"
          >
            <span class="stat-label">
              <IconifyIconOffline icon="warningRounded" />
              {{ t("home.dashboard.errors") }}
            </span>
            <span class="stat-value">{{ summary.errors }}</span>
            <span class="stat-hint">
              {{
                summary.errors > 0
                  ? t("home.dashboard.errorsHint")
                  : t("home.dashboard.noErrors")
              }}
            </span>
          </button>
          <button
            type="button"
            class="text-left stat-card app-panel is-clickable"
            @click="$router.push({ name: 'Download' })"
          >
            <span class="stat-label">
              <IconifyIconOffline icon="download" />
              {{ t("home.dashboard.frpcVersion") }}
            </span>
            <span class="stat-value">{{ summary.versions }}</span>
            <span class="stat-hint">{{ t("home.dashboard.manage") }}</span>
          </button>
        </section>

        <section class="p-4 app-panel">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-sm font-semibold">
              {{ t("home.dashboard.statusTitle") }}
            </h3>
            <el-button
              text
              type="primary"
              size="small"
              @click="$router.push({ name: 'Tunnel' })"
            >
              {{ t("home.dashboard.manageInstances") }}
              <IconifyIconOffline class="ml-1" icon="arrow-forward-rounded" />
            </el-button>
          </div>
          <el-table
            v-loading="!tunnelStore.loaded"
            :data="tunnelStore.tunnels"
            row-key="id"
            stripe
            :empty-text="t('home.dashboard.noInstances')"
          >
            <el-table-column :label="t('home.dashboard.status')" width="120">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.id)" size="small">
                  {{ statusLabel(row.id) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('home.dashboard.instance')"
              prop="name"
              min-width="140"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="font-semibold text-primary">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column
              :label="t('home.dashboard.server')"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span v-if="row.serverAddr" class="is-mono">
                  {{ row.serverAddr }}:{{ row.serverPort }}
                </span>
                <span v-else class="text-text_color_secondary">
                  {{ t("home.dashboard.notConfigured") }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="t('home.dashboard.proxies')" width="130">
              <template #default="{ row }">
                {{
                  t("home.dashboard.proxiesValue", {
                    enabled: row.proxyEnabled,
                    total: row.proxyTotal
                  })
                }}
              </template>
            </el-table-column>
            <el-table-column
              :label="t('home.status.runningTime')"
              min-width="160"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span v-if="statusKey(row.id) === 'error'" class="status-error">
                  {{ tunnelStore.statusOf(row.id).connectionError }}
                </span>
                <span
                  v-else-if="statusKey(row.id) === 'running'"
                  class="tabular-nums"
                >
                  {{ uptimeText(row.id) }}
                </span>
                <span v-else class="text-text_color_secondary">-</span>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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

.stat-card.is-warning {
  .stat-label,
  .stat-value {
    color: var(--el-color-warning);
  }
}

.status-error {
  color: var(--el-color-warning);
}

.is-mono {
  font-family: var(--app-mono);
}
</style>
