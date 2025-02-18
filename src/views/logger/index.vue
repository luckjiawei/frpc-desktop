<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { ipcRenderer } from "electron";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";

defineComponent({
  name: "Logger"
});

const loggerContent = ref('<div class="text-white">暂无日志</div>');

const formatLogContent = (logContent: string) => {
  const logs = logContent
    .split("\n")
    .filter(f => f)
    .map(m => {
      if (m.indexOf("[E]") !== -1) {
        return `<div class="text-[#FF0006]">${m}</div> `;
      } else if (m.indexOf("[I]") !== -1) {
        return `<div class="text-[#48BB31]">${m}</div> `;
      } else if (m.indexOf("[D]") !== -1) {
        return `<div class="text-[#0070BB]">${m}</div> `;
      } else if (m.indexOf("[W]") !== -1) {
        return `<div class="text-[#BBBB23]">${m}</div> `;
      } else {
        return `<div class="text-[#BBBBBB]">${m}</div> `;
      }
    });
  return logs.reverse().join("");
};
const refreshStatus = ref(false);
const logLoading = ref(true);
// const isWatch = ref(false);

onMounted(() => {
  ipcRenderer.send("log/getFrpLogContent");
  ipcRenderer.on("log/getFrpLogContent.hook", (event, args) => {
    const { success, data } = args;
    if (success) {
      loggerContent.value = formatLogContent(data);
    }
    logLoading.value = false;
    if (refreshStatus.value) {
      // 刷新逻辑
      ElMessage({
        type: "success",
        message: "刷新成功"
      });
    } else {
      // if (!isWatch.value) {
      //   // ipcRenderer.send("log/watchFrpcLogContent");
      //   isWatch.value = true;
      // }
    }
  });
  ipcRenderer.on("log/watchFrpcLogContent.hook", (event, args) => {
    console.log(event,'eevent');
    console.log("watchFrpcLogContent", args);
    const { success, data } = args;
    if (success && data) {
      ipcRenderer.send("log/getFrpLogContent");
    }
    // if (args) {
    //   loggerContent.value = formatLogContent(args);
    // }
  });
  // ipcRenderer.on("log/watchFrpcLogContent.hook", (event, args) => {
  //   console.log("watchFrpcLogContent", args);
  //   const { success, data } = args;
  //   if (success && data) {
  //     ipcRenderer.send("log/getFrpLogContent");
  //   }
  //   // if (args) {
  //   //   loggerContent.value = formatLogContent(args);
  //   // }
  // });
  ipcRenderer.on("log/openFrpcLogFile.hook", (event, args) => {
    const { success } = args;
    if (success) {
      ElMessage({
        type: "success",
        message: "打开日志成功"
      });
    }
  });
});

const openLocalLog = useDebounceFn(() => {
  ipcRenderer.send("log/openFrpcLogFile");
}, 1000);

const refreshLog = useDebounceFn(() => {
  // ElMessage({
  //   type: "warning",
  //   icon: "<IconifyIconOffline icon=\"file-open-rounded\" />",
  //   message: "正在刷新日志..."
  // });
  refreshStatus.value = true;
  logLoading.value = true;
  ipcRenderer.send("log/getFrpLogContent");
}, 300);

onUnmounted(() => {
  ipcRenderer.removeAllListeners("log/getFrpLogContent.hook");
  ipcRenderer.removeAllListeners("log/openFrpcLogFile.hook");
});
</script>
<template>
  <div class="main">
    <breadcrumb>
      <el-button plain type="primary" @click="refreshLog">
        <IconifyIconOffline icon="refresh-rounded" />
      </el-button>
      <el-button plain type="primary" @click="openLocalLog">
        <IconifyIconOffline icon="file-open-rounded" />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb" v-loading="logLoading">
      <div
        class="w-full h-full p-2 bg-[#2B2B2B] rounded drop-shadow-lg overflow-y-auto"
        v-html="loggerContent"
      ></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
::-webkit-scrollbar-track-piece {
  background-color: transparent;
}
</style>
