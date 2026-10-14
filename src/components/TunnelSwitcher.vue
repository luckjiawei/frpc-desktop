<script lang="ts" setup>
import { useTunnelStore } from "@/store/tunnel";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /** 返回 false 时取消切换，例如当前表单有未保存的修改 */
  beforeChange?: (tunnelId: string) => boolean | Promise<boolean>;
  /** 只有一个实例时也显示，用于标明当前页面属于哪个实例 */
  alwaysShow?: boolean;
}>();

const { t } = useI18n();
const tunnelStore = useTunnelStore();

const selected = computed({
  get: () => tunnelStore.currentTunnelId,
  set: async (tunnelId: string) => {
    if (tunnelId === tunnelStore.currentTunnelId) return;
    if (props.beforeChange && !(await props.beforeChange(tunnelId))) return;
    tunnelStore.setCurrentTunnel(tunnelId);
  }
});

const statusClass = (tunnelId: string) => {
  const status = tunnelStore.statusOf(tunnelId);
  if (!status.running) return "is-stopped";
  return status.connectionError ? "is-error" : "is-running";
};

const statusText = (tunnelId: string) => {
  const status = tunnelStore.statusOf(tunnelId);
  if (!status.running) return t("home.status.disconnected");
  return status.connectionError
    ? t("home.status.connectionError")
    : t("home.status.running");
};
</script>

<template>
  <el-select
    v-if="alwaysShow || tunnelStore.hasMultiple"
    v-model="selected"
    class="tunnel-switcher"
    :aria-label="t('tunnel.switcher')"
    :title="t('tunnel.switcher')"
  >
    <template #prefix>
      <span
        class="status-dot"
        :class="statusClass(tunnelStore.currentTunnelId)"
        aria-hidden="true"
      />
    </template>
    <el-option
      v-for="tunnel in tunnelStore.tunnels"
      :key="tunnel.id"
      :label="tunnel.name"
      :value="tunnel.id"
    >
      <span class="flex gap-2 items-center min-w-0">
        <span
          class="status-dot"
          :class="statusClass(tunnel.id)"
          aria-hidden="true"
        />
        <span class="flex-1 truncate">{{ tunnel.name }}</span>
        <span class="text-xs text-text_color_secondary">
          {{ statusText(tunnel.id) }}
        </span>
      </span>
    </el-option>
  </el-select>
</template>

<style scoped lang="scss">
.tunnel-switcher {
  width: 200px;
}

.status-dot {
  flex: none;
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);

  &.is-running {
    background: var(--el-color-success);
  }

  &.is-error {
    background: var(--el-color-warning);
  }
}
</style>
