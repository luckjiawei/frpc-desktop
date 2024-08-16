<script lang="ts" setup>
import {defineComponent, onMounted, onUnmounted, ref} from "vue";
import {ipcRenderer} from "electron";
import moment from "moment";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import {ElMessage} from "element-plus";
import {useDebounceFn} from "@vueuse/core";


defineComponent({
  name: "Download"
});

const versions = ref<Array<FrpVersion>>([]);
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
const handleDownload = useDebounceFn((version: FrpVersion) => {
  ipcRenderer.send("github.download", version.id);
  downloading.value.set(version.id, 0);
}, 300);

/**
 * 删除下载
 * @param version
 */
const handleDeleteVersion = useDebounceFn((version: FrpVersion) => {
  ipcRenderer.send("github.deleteVersion", {
    id: version.id,
    absPath: version.absPath
  });
}, 300);

const handleInitDownloadHook = () => {
  ipcRenderer.on("Download.frpVersionHook", (event, args) => {
    loading.value--;
    versions.value = args.map(m => {
      m.published_at = moment(m.published_at).format("YYYY-MM-DD HH:mm:ss")
      return m as FrpVersion;
    }) as Array<FrpVersion>;
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
    const version: FrpVersion | undefined = versions.value.find(
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
    <!--    <breadcrumb>-->
    <!--      <div class="flex items-center">-->
    <!--        <el-checkbox>加速下载</el-checkbox>-->
    <!--      </div>-->
    <!--    </breadcrumb>-->
    <div class="app-container-breadcrumb pr-2" v-loading="loading > 0">
      <template v-if="versions && versions.length > 0">
        <el-row :gutter="20">
          <el-col
              v-for="version in versions"
              :key="version.id"
              :lg="8"
              :md="8"
              :sm="12"
              :xl="6"
              :xs="24"
              class="mb-[20px]"
          >
            <div
                class="w-full bg-white rounded p-4 drop-shadow-lg flex justify-between items-center"
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
                  <el-button type="text" class="danger-text" @click="handleDeleteVersion(version)">
                    <IconifyIconOffline class="mr-1" icon="delete-rounded"/>
                    删除
                  </el-button>

                </div>

                <template v-else>
                  <div class="w-32" v-if="downloading.has(version.id)">
                    <el-progress
                        :percentage="downloading.get(version.id)"
                        :text-inside="false"
                    />
                  </div>
                  <el-button v-else size="small" type="primary" @click="handleDownload(version)">
                    <IconifyIconOffline class="mr-1" icon="download"/>
                    下载
                  </el-button>
                </template>
              </div>
            </div>
          </el-col>
        </el-row>

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
