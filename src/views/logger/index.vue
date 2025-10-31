<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";
import LogView from "./LogView.vue";
import { LogLevel, LogRecord } from "./log";

defineComponent({
  name: "Logger"
});

const { t } = useI18n();

const refreshStatus = ref(false);
const logLoading = ref(true);
const autoRefresh = ref(false);
const autoRefreshTimer = ref(null);
const autoRefreshTime = ref(10);
const activeTabName = ref("app_log");
const logRecords = ref<Array<LogRecord>>([]);

const openLocalLog = useDebounceFn(() => {
  if (activeTabName.value === "app_log") {
    send(ipcRouters.LOG.openAppLogFile);
  } else {
    send(ipcRouters.LOG.openFrpcLogFile);
  }
}, 1000);

const refreshLog = useDebounceFn(() => {
  // ElMessage({
  //   type: "warning",
  //   icon: "<IconifyIconOffline icon=\"file-open-rounded\" />",
  //   message: "正在刷新日志..."
  // });
  refreshStatus.value = true;
  logLoading.value = true;
  if (activeTabName.value === "app_log") {
    send(ipcRouters.LOG.getAppLogContent);
  } else {
    send(ipcRouters.LOG.getFrpLogContent);
  }
}, 300);

const handleAutoRefreshChange = () => {
  if (autoRefresh.value) {
    if (autoRefreshTimer.value) {
      clearInterval(autoRefreshTimer.value);
    }
    autoRefreshTimer.value = setInterval(() => {
      autoRefreshTime.value--;
      if (autoRefreshTime.value <= 0) {
        autoRefreshTime.value = 10;
        refreshLog();
      }
    }, 1000);
  } else {
    clearInterval(autoRefreshTimer.value);
    autoRefreshTime.value = 10;
  }
};

const handleTabChange = (tab: string) => {
  activeTabName.value = tab;
  logRecords.value = [];
  if (tab === "app_log") {
    send(ipcRouters.LOG.getAppLogContent);
  } else {
    send(ipcRouters.LOG.getFrpLogContent);
  }
};

onMounted(() => {
  on(ipcRouters.LOG.getFrpLogContent, data => {
    if (data) {
      data.split("\n").forEach(line => {
        if (line.indexOf("[E]") !== -1) {
          logRecords.value.push({ context: line, level: LogLevel.ERROR });
        } else if (line.indexOf("[I]") !== -1) {
          logRecords.value.push({ context: line, level: LogLevel.INFO });
        } else if (line.indexOf("[D]") !== -1) {
          logRecords.value.push({ context: line, level: LogLevel.DEBUG });
        } else if (line.indexOf("[W]") !== -1) {
          logRecords.value.push({ context: line, level: LogLevel.WARN });
        } else {
          logRecords.value.push({ context: line, level: LogLevel.INFO });
        }
      });

      logRecords.value = logRecords.value.reverse();
    }

    logLoading.value = false;
    if (refreshStatus.value) {
      // 刷新逻辑
      ElMessage({
        type: "success",
        message: t("logger.message.refreshSuccess")
      });
      refreshStatus.value = false;
    }
  });

  on(ipcRouters.LOG.getAppLogContent, data => {
    if (data) {
      // logRecords.value = data.split("\n").map(line => {
      //   if (line.indexOf("[error]") !== -1) {
      //     return { context: line, level: LogLevel.ERROR };
      //   } else if (line.indexOf("[info]") !== -1) {
      //     return { context: line, level: LogLevel.INFO };
      //   } else if (line.indexOf("[debug]") !== -1) {
      //     return { context: line, level: LogLevel.DEBUG };
      //   } else if (line.indexOf("[warn]") !== -1) {
      //     return { context: line, level: LogLevel.WARN };
      //   } else {
      //     return { context: line, level: LogLevel.INFO };
      //   }
      // });
      // logRecords.value = logRecords.value.reverse();
    }

    logLoading.value = false;
    if (refreshStatus.value) {
      // 刷新逻辑
      ElMessage({
        type: "success",
        message: t("logger.message.refreshSuccess")
      });
      refreshStatus.value = false;
    }
  });

  on(ipcRouters.LOG.openFrpcLogFile, () => {
    ElMessage({
      type: "success",
      message: t("logger.message.openSuccess")
    });
  });

  // send(ipcRouters.LOG.getFrpLogContent);
  send(ipcRouters.LOG.getAppLogContent);
});

onUnmounted(() => {
  removeRouterListeners(ipcRouters.LOG.getFrpLogContent);
  removeRouterListeners(ipcRouters.LOG.getAppLogContent);
  removeRouterListeners(ipcRouters.LOG.openFrpcLogFile);
  // removeRouterListeners2(listeners.watchFrpcLog);
  clearInterval(autoRefreshTimer.value);
  autoRefreshTime.value = 10;
});

// onDeactivated(() => {
//   console.log("onDeactivated");
// });
</script>
<template>
  <div class="main">
    <breadcrumb> </breadcrumb>
    <div class="app-container-breadcrumb">
      <el-tabs
        v-model="activeTabName"
        class="log-tabs"
        @tab-change="handleTabChange"
      >
        <el-tab-pane
          :label="t('logger.tab.appLog')"
          name="app_log"
          class="log-container"
        >
          <log-view :logRecords="logRecords" :loading="logLoading">
            <template #toolbar>
              <span
                v-if="autoRefresh"
                class="text-sm font-medium text-gray-300"
                >{{
                  t("logger.autoRefreshTime", { time: autoRefreshTime })
                }}</span
              >
              <el-popover
                class="box-item"
                title="Title"
                content="Top Left prompts info"
                placement="top-start"
              >
                <el-switch
                  size="small"
                  v-model="autoRefresh"
                  @change="handleAutoRefreshChange"
                  class="text-gray-300"
                  >{{ t("logger.autoRefresh") }}</el-switch
                >
              </el-popover>
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="refresh-rounded"
                @click="refreshLog"
                size="small"
              />
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="file-open-rounded"
                @click="openLocalLog"
              />
            </template>
          </log-view>
        </el-tab-pane>
        <el-tab-pane
          :label="t('logger.tab.frpcLog')"
          name="frpc_log"
          class="log-container"
        >
          <log-view :logRecords="logRecords" :loading="logLoading">
            <template #toolbar>
              <span
                v-if="autoRefresh"
                class="text-sm font-medium text-gray-300"
                >{{
                  t("logger.autoRefreshTime", { time: autoRefreshTime })
                }}</span
              >
              <el-switch
                size="small"
                v-model="autoRefresh"
                @change="handleAutoRefreshChange"
                class="text-gray-300"
                >{{ t("logger.autoRefresh") }}</el-switch
              >
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="refresh-rounded"
                @click="refreshLog"
                size="small"
              />
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="file-open-rounded"
                @click="openLocalLog"
              />
            </template>
          </log-view>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
::-webkit-scrollbar-track-piece {
  background-color: transparent;
}

.log-tabs {
  height: 100%;
}

.log-container {
  height: 100%;
}
</style>
