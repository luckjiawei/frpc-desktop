<script lang="ts" setup>
import {defineComponent, onMounted, onUnmounted, ref} from "vue";
import {ipcRenderer} from "electron";
import moment from "moment";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import {Icon} from "@iconify/vue";
import {ElMessage} from "element-plus";

defineComponent({
  name: "Download"
});

type Asset = {
  name: string
}

type Version = {
  id: string;
  name: string;
  published_at: string;
  download_completed: boolean;
  absPath: string;
  assets: Asset[]
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

/**
 * 删除下载
 * @param version
 */
const handleDeleteVersion = (version: Version) => {
  ipcRenderer.send("github.deleteVersion", {
    id: version.id,
    absPath: version.absPath
  });
}

const handleInitDownloadHook = () => {
  ipcRenderer.on("Download.frpVersionHook", (event, args) => {
    loading.value--;
    versions.value = args.map(m => {
      m.published_at = moment(m.published_at).format("YYYY-MM-DD HH:mm:ss")
      return m as Version;
    }) as Array<Version>;
    console.log(versions, 'versions')
  });
  // 进度监听
  ipcRenderer.on("Download.frpVersionDownloadOnProgress", (event, args) => {
    const {id, progress} = args;
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
  ipcRenderer.on("Download.deleteVersion.hook", (event, args) => {
    const {err, data} = args
    if (!err) {
      loading.value++;
      ElMessage({
        type: "success",
        message: "删除成功"
      });
      handleLoadVersions();
    }

  })
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
  ipcRenderer.removeAllListeners("Download.deleteVersion.hook");
});
</script>
<template>
  <div class="main">
    <breadcrumb/>
    <div class="app-container-breadcrumb pr-2" v-loading="loading > 0">
      <template v-if="versions && versions.length > 0">
        <div
            class="w-full bg-white mb-4 rounded p-4 drop-shadow-lg flex justify-between items-center"
            v-for="version in versions"
            :key="version.id"
        >
          <div class="left">
            <div class="mb-2">
              <el-tag>{{ version.name }}</el-tag>
              <!--              <el-tag class="ml-2">原文件名：{{ version.assets[0]?.name }}</el-tag>-->
            </div>
            <div class="text-sm">
              发布时间：<span class="text-gray-00">{{
                // moment(version.published_at).format("YYYY-MM-DD HH:mm:ss")
                version.published_at
              }}</span>
            </div>
          </div>
          <div class="right">
            <div v-if="version.download_completed">
              <el-button type="text">已下载</el-button>
              <!--              <span-->
              <!--                  class="primary-text text-sm font-bold ml-2"-->
              <!--              >已下载</span>-->

              <el-button type="text" class="danger-text" @click="handleDeleteVersion(version)">
                <Icon class="mr-1" icon="material-symbols:delete"/>
                删除
              </el-button>
              <!--              <div>-->
              <!--                <Icon class="mr-1" icon="material-symbols:download-2"/>-->
              <!--                <span-->
              <!--                    class="danger-text text-sm font-bold ml-2"-->
              <!--                >删除下载</span>-->
              <!--              </div>-->

            </div>

            <template v-else>
              <div class="w-32" v-if="downloading.has(version.id)">
                <el-progress
                    :percentage="downloading.get(version.id)"
                    :text-inside="false"
                />
              </div>
              <el-button v-else size="small" type="primary" @click="handleDownload(version)">
                <Icon class="mr-1" icon="material-symbols:download-2"/>
                下载
              </el-button>
            </template>
          </div>
        </div>
      </template>
      <div
          v-else
          class="w-full h-full bg-white rounded p-2 overflow-hidden drop-shadow-xl flex justify-center items-center"
      >
        <el-empty description="暂无可用版本"/>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
