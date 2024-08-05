<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { ipcRenderer } from "electron";

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
    if (args) {
      loggerContent.value = handleLog2Html(args);
    }
  });
});

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Logger.getLog.hook");
});
</script>
<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <div
        class="w-full h-full p-4 bg-[#2B2B2B] rounded drop-shadow-lg overflow-y-auto"
        v-html="loggerContent"
      ></div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
