<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { on, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";
import LogView from "./LogView.vue";
import { LogRecord, parseAppLog } from "./log";
import { useLogAutoRefresh } from "./useLogAutoRefresh";

defineComponent({
  name: "Logger"
});

// 左侧菜单的日志页只展示应用日志；各实例的 frpc 日志在“实例”页面的日志抽屉中查看
const { t } = useI18n();

const manualRefresh = ref(false);
const logLoading = ref(true);
const logRecords = ref<Array<LogRecord>>([]);
const listenerCleanups: Array<() => void> = [];

const loadLog = () => {
  logLoading.value = true;
  send(ipcRouters.LOG.getAppLogContent);
};

const { autoRefresh, countdown } = useLogAutoRefresh(loadLog);

const refreshLog = useDebounceFn(() => {
  manualRefresh.value = true;
  loadLog();
}, 300);

const openLocalLog = useDebounceFn(() => {
  send(ipcRouters.LOG.openAppLogFile);
}, 1000);

onMounted(() => {
  listenerCleanups.push(
    on(ipcRouters.LOG.getAppLogContent, (data: string) => {
      logRecords.value = data ? parseAppLog(data) : [];
      logLoading.value = false;
      if (manualRefresh.value) {
        ElMessage({
          type: "success",
          message: t("logger.message.refreshSuccess")
        });
        manualRefresh.value = false;
      }
    })
  );
  listenerCleanups.push(
    on(ipcRouters.LOG.openAppLogFile, () => {
      ElMessage({
        type: "success",
        message: t("logger.message.openSuccess")
      });
    })
  );
  loadLog();
});

onUnmounted(() => {
  listenerCleanups.splice(0).forEach(off => off());
});
</script>
<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <log-view :log-records="logRecords" :loading="logLoading">
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
    </div>
  </div>
</template>
