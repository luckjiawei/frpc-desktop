<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";

defineComponent({
  name: "Logger"
});

const { t } = useI18n();

const loggerContent = ref(
  `<div class="text-white">${t("logger.content.empty")}</div>`
);

const formatLogContent = (logContent: string) => {
  const logs = logContent
    .split("\n")
    .filter(f => f)
    .map(m => {
      if (m.indexOf("[E]") !== -1 || m.indexOf("[error]") !== -1) {
        return `<div class="text-[#FF0006]">${m}</div> `;
      } else if (m.indexOf("[I]") !== -1 || m.indexOf("[info]") !== -1) {
        return `<div class="text-[#48BB31]">${m}</div> `;
      } else if (m.indexOf("[D]") !== -1 || m.indexOf("[debug]") !== -1) {
        return `<div class="text-[#0070BB]">${m}</div> `;
      } else if (m.indexOf("[W]") !== -1 || m.indexOf("[warn]") !== -1) {
        return `<div class="text-[#BBBB23]">${m}</div> `;
      } else {
        return `<div class="text-[#BBBBBB]">${m}</div> `;
      }
    });
  return logs.reverse().join("");
};
const refreshStatus = ref(false);
const logLoading = ref(true);
const autoRefresh = ref(false);
const autoRefreshTimer = ref(null);
const autoRefreshTime = ref(10);
const activeTabName = ref("system_log");
// const isWatch = ref(false);

const openLocalLog = useDebounceFn(() => {
  if (activeTabName.value === "system_log") {
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
  if (activeTabName.value === "system_log") {
    send(ipcRouters.LOG.getAppLogContent);
  } else {
    send(ipcRouters.LOG.getFrpLogContent);
  }
}, 300);

const handleAutoRefreshChange = () => {
  if (autoRefresh.value) {
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
  if (tab === "system_log") {
    send(ipcRouters.LOG.getAppLogContent);
  } else {
    send(ipcRouters.LOG.getFrpLogContent);
  }
};

onMounted(() => {
  on(ipcRouters.LOG.getFrpLogContent, data => {
    if (data) {
      loggerContent.value = formatLogContent(data as string);
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
      loggerContent.value = formatLogContent(data as string);
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
    <breadcrumb>
      <span v-if="autoRefresh" class="mr-2 text-sm text-primary">{{
        t("logger.autoRefreshTime", { time: autoRefreshTime })
      }}</span>
      <el-switch
        class="mr-2"
        v-model="autoRefresh"
        @change="handleAutoRefreshChange"
        >{{ t("logger.autoRefresh") }}</el-switch
      >
      <el-button plain type="primary" @click="refreshLog">
        <IconifyIconOffline icon="refresh-rounded" />
      </el-button>
      <el-button plain type="primary" @click="openLocalLog">
        <IconifyIconOffline icon="file-open-rounded" />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb">
      <el-tabs
        v-model="activeTabName"
        class="log-tabs"
        @tab-change="handleTabChange"
      >
        <el-tab-pane label="系统日志" name="system_log" class="log-container">
          <div
            class="w-full h-full p-2 bg-[#2B2B2B] rounded drop-shadow-lg overflow-y-auto"
            v-html="loggerContent"
          ></div>
        </el-tab-pane>
        <el-tab-pane label="连接日志" name="frpc_log" class="log-container">
          <div
            class="w-full h-full p-2 bg-[#2B2B2B] rounded drop-shadow-lg overflow-y-auto"
            v-html="loggerContent"
          ></div>
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
