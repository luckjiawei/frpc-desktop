<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { ipcRenderer } from "electron";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useDebounce, useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";

defineComponent({
  name: "Logger"
});

const loggerContent = ref('<div class="text-white">暂无日志</div>');

const handleLog2Html = (logContent: string) => {
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

onMounted(() => {
  ipcRenderer.send("logger.getLog");
  ipcRenderer.on("Logger.getLog.hook", (event, args) => {
    // console.log("日志", args, args.indexOf("\n"));
    // const logs = args.split("\n");
    // console.log(logs, "2");
    if (args) {
      loggerContent.value = handleLog2Html(args);
    }
    ipcRenderer.send("logger.update");
  });
  ipcRenderer.on("Logger.update.hook", (event, args) => {
    console.log("logger update hook", 1);
    if (args) {
      loggerContent.value = handleLog2Html(args);
    }
  });

  ipcRenderer.on("Logger.openLog.hook", (event, args) => {
    if (args) {
      ElMessage({
        type: "success",
        message: "打开日志成功"
      });
    }
  });
});

const openLocalLog = useDebounceFn(() => {
  console.log('打开啊日志');
  ipcRenderer.send("logger.openLog");
}, 300);

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Logger.getLog.hook");
});
</script>
<template>
  <div class="main">
    <breadcrumb>
      <el-button plain type="primary" @click="openLocalLog">
        <IconifyIconOffline icon="file-open-rounded"  />
      </el-button>
    </breadcrumb>
    <div class="app-container-breadcrumb">
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
