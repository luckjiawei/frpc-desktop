import { useDebounceFn } from "@vueuse/core";
import { onMounted, onUnmounted, ref } from "vue";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { IPCChannels } from "../../../electron/core/constant";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";

export enum LogLevel {
  ERROR = "error",
  INFO = "info",
  DEBUG = "debug",
  WARN = "warn"
}

export type LogRecord = {
  context: string;
  level: LogLevel;
  id: number;
};

export const useLogger = () => {
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
      send(IPCChannels.LOG_OPEN_APP_LOG_FILE);
    } else {
      send(IPCChannels.LOG_OPEN_FRPC_LOG_FILE);
    }
  }, 1000);

  const refreshLog = useDebounceFn(() => {
    refreshStatus.value = true;
    logLoading.value = true;
    logRecords.value = [];
    if (activeTabName.value === "app_log") {
      send(IPCChannels.LOG_GET_APP_LOG_CONTENT);
    } else {
      send(IPCChannels.LOG_GET_FRP_LOG_CONTENT);
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
      send(IPCChannels.LOG_GET_APP_LOG_CONTENT);
    } else {
      send(IPCChannels.LOG_GET_FRP_LOG_CONTENT);
    }
  };

  onMounted(() => {
    on(IPCChannels.LOG_GET_FRP_LOG_CONTENT, data => {
      if (data) {
        logRecords.value = data.split("\n").map(line => {
          if (line.indexOf("[E]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.ERROR };
          } else if (line.indexOf("[I]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.INFO };
          } else if (line.indexOf("[D]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.DEBUG };
          } else if (line.indexOf("[W]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.WARN };
          } else {
            return { id: Date.now(), context: line, level: LogLevel.INFO };
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

    on(IPCChannels.LOG_GET_APP_LOG_CONTENT, data => {
      if (data) {
        logRecords.value = data.split("\n").map(line => {
          if (line.indexOf("[error]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.ERROR };
          } else if (line.indexOf("[info]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.INFO };
          } else if (line.indexOf("[debug]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.DEBUG };
          } else if (line.indexOf("[warn]") !== -1) {
            return { id: Date.now(), context: line, level: LogLevel.WARN };
          } else {
            return { id: Date.now(), context: line, level: LogLevel.INFO };
          }
        });
        logRecords.value = logRecords.value.reverse();
      }

      logLoading.value = false;
      if (refreshStatus.value) {
        ElMessage({
          type: "success",
          message: t("logger.message.refreshSuccess")
        });
        refreshStatus.value = false;
      }
    });

    on(IPCChannels.LOG_OPEN_FRPC_LOG_FILE, () => {
      ElMessage({
        type: "success",
        message: t("logger.message.openSuccess")
      });
    });

    send(IPCChannels.LOG_GET_APP_LOG_CONTENT);
  });

  onUnmounted(() => {
    removeRouterListeners(IPCChannels.LOG_GET_FRP_LOG_CONTENT);
    removeRouterListeners(IPCChannels.LOG_GET_APP_LOG_CONTENT);
    removeRouterListeners(IPCChannels.LOG_OPEN_FRPC_LOG_FILE);
    clearInterval(autoRefreshTimer.value);
    autoRefreshTime.value = 10;
  });

  return {
    logRecords,
    logLoading,
    autoRefresh,
    autoRefreshTime,
    activeTabName,
    refreshLog,
    openLocalLog,
    handleAutoRefreshChange,
    handleTabChange
  };
};
