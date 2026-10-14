<script lang="ts" setup>
import { on, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";
import LogView from "@/views/logger/LogView.vue";
import { LogRecord, parseFrpcLog } from "@/views/logger/log";
import { useLogAutoRefresh } from "@/views/logger/useLogAutoRefresh";

const visible = defineModel<boolean>({ required: true });
const props = defineProps<{
  tunnel: TunnelSummary | null;
}>();

const { t } = useI18n();
const loading = ref(false);
const records = ref<Array<LogRecord>>([]);
const listenerCleanups: Array<() => void> = [];

const loadLog = () => {
  if (!props.tunnel) return;
  loading.value = true;
  send(ipcRouters.LOG.getFrpLogContent, { tunnelId: props.tunnel.id });
};

const { autoRefresh, countdown } = useLogAutoRefresh(loadLog);

const refreshLog = useDebounceFn(loadLog, 300);

const openLocalLog = useDebounceFn(() => {
  if (!props.tunnel) return;
  send(ipcRouters.LOG.openFrpcLogFile, { tunnelId: props.tunnel.id });
}, 1000);

watch(
  () => [visible.value, props.tunnel?.id],
  ([open]) => {
    records.value = [];
    if (open) {
      loadLog();
    } else {
      autoRefresh.value = false;
    }
  }
);

onMounted(() => {
  listenerCleanups.push(
    on(ipcRouters.LOG.getFrpLogContent, (data: string) => {
      records.value = data ? parseFrpcLog(data) : [];
      loading.value = false;
    })
  );
  listenerCleanups.push(
    on(ipcRouters.LOG.openFrpcLogFile, () => {
      ElMessage({
        type: "success",
        message: t("logger.message.openSuccess")
      });
    })
  );
});

onUnmounted(() => {
  listenerCleanups.splice(0).forEach(off => off());
});
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="t('tunnel.log.title', { name: tunnel?.name ?? '' })"
    size="min(760px, 85%)"
    class="tunnel-log-drawer"
  >
    <log-view :log-records="records" :loading="loading">
      <template #toolbar>
        <span v-if="autoRefresh" class="text-sm font-medium text-gray-300">
          {{ t("logger.autoRefreshTime", { time: countdown }) }}
        </span>
        <el-switch
          v-model="autoRefresh"
          size="small"
          :active-text="t('logger.autoRefresh')"
          class="log-switch"
        />
        <el-button
          text
          size="small"
          class="log-tool"
          :aria-label="t('logger.refresh')"
          :title="t('logger.refresh')"
          @click="refreshLog"
        >
          <IconifyIconOffline icon="refresh-rounded" />
        </el-button>
        <el-button
          text
          size="small"
          class="log-tool"
          :aria-label="t('logger.openFile')"
          :title="t('logger.openFile')"
          @click="openLocalLog"
        >
          <IconifyIconOffline icon="file-open-rounded" />
        </el-button>
      </template>
    </log-view>
  </el-drawer>
</template>

<style lang="scss">
.tunnel-log-drawer .el-drawer__body {
  display: flex;
  padding-top: 0;
}
</style>
