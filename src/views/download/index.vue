<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { ipcRenderer } from "electron";
import moment from "moment";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
defineComponent({
  name: "Download"
});

type Version = {
  id: string;
  name: string;
  published_at: string;
  download_completed: boolean;
};

const versions = ref<Array<Version>>([]);
const loading = ref(1);
const downloadPercentage = ref(0);
const downloading = ref<Map<string, number>>(new Map<string, number>());

/**
 * 获取版本
 */
const handleLoadVersions = () => {
  ipcRenderer.send("github.getFrpVersions");
};

/**
 * 下载
 * @param version
 */
const handleDownload = (version: Version) => {
  ipcRenderer.send("github.download", version.id);
  downloading.value.set(version.id, 0);
};

const handleInitDownloadHook = () => {
  ipcRenderer.on("Download.frpVersionHook", (event, args) => {
    loading.value--;
    versions.value = args as Array<Version>;
  });
  // 进度监听
  ipcRenderer.on("Download.frpVersionDownloadOnProgress", (event, args) => {
    const { id, progress } = args;
    downloading.value.set(
      id,
      Number(Number(progress.percent * 100).toFixed(2))
    );
  });
  ipcRenderer.on("Download.frpVersionDownloadOnCompleted", (event, args) => {
    downloading.value.delete(args);
    const version: Version | undefined = versions.value.find(
      f => f.id === args
    );
    if (version) {
      version.download_completed = true;
    }
  });
};

onMounted(() => {
  handleLoadVersions();
  handleInitDownloadHook();
  // ipcRenderer.invoke("process").then((r: any) => {
  //   console.log(r, "rrr");
  // });
});

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Download.frpVersionDownloadOnProgress");
  ipcRenderer.removeAllListeners("Download.frpVersionDownloadOnCompleted");
  ipcRenderer.removeAllListeners("Download.frpVersionHook");
});
</script>
<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb" v-loading="loading > 0">
      <div
        class="w-full bg-white mb-4 rounded p-4 drop-shadow-lg flex justify-between items-center"
        v-for="version in versions"
        :key="version.id"
      >
        <div class="left">
          <div class="mb-2">
            <el-tag>{{ version.name }}</el-tag>
          </div>
          <div class="text-sm">
            发布时间：<span class="text-gray-00">{{
              moment(version.published_at).format("YYYY-MM-DD HH:mm:ss")
            }}</span>
          </div>
        </div>
        <div class="right">
        <span
          class="primary-text text-sm font-bold"
          v-if="version.download_completed"
        >已下载</span
        >
          <template v-else>
            <div class="w-32" v-if="downloading.has(version.id)">
              <el-progress
                :percentage="downloading.get(version.id)"
                :text-inside="false"
              />
            </div>
            <el-button v-else @click="handleDownload(version)">下载</el-button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
