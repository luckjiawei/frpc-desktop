<script lang="ts" setup>
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import moment from "moment";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useDebounceFn } from "@vueuse/core";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { ipcRouters } from "../../../electron/core/IpcRouter";

defineComponent({
  name: "Download"
});

const versions = ref<Array<FrpcVersion>>([]);
const loading = ref(1);
const downloadPercentage = ref(0);
const downloading = ref<Map<number, number>>(new Map<number, number>());
const currMirror = ref("github");
const mirrors = ref<Array<GitHubMirror>>([
  {
    id: "github",
    name: "github"
  }
]);

/**
 * 获取版本
 */
const handleLoadAllVersions = () => {
  send(ipcRouters.VERSION.getVersions);
};

/**
 * 下载
 * @param version
 */
const handleDownload = useDebounceFn((version: FrpcVersion) => {
  send(ipcRouters.VERSION.downloadVersion, {
    githubReleaseId: version.githubReleaseId
  });
  downloading.value.set(version.githubReleaseId, 0);
}, 300);

/**
 * 删除下载
 * @param version
 */
const handleDeleteVersion = useDebounceFn((version: FrpcVersion) => {
  ElMessageBox.alert(
    `确认要删除 <span class="text-primary font-bold">${version.name} </span>  吗？`,
    "提示",
    {
      showCancelButton: true,
      cancelButtonText: "取消",
      dangerouslyUseHTMLString: true,
      confirmButtonText: "删除"
    }
  ).then(() => {
    send(ipcRouters.VERSION.deleteDownloadedVersion, {
      githubReleaseId: version.githubReleaseId
    });
    // ipcRenderer.send("github.deleteVersion", {
    //   id: version.id,
    //   absPath: version.absPath
    // });
  });
}, 300);

// const handleInitDownloadHook = () => {
//   ipcRenderer.on("Download.deleteVersion.hook", (event, args) => {
//     const { err, data } = args;
//     if (!err) {
//       loading.value++;
//       ElMessage({
//         type: "success",
//         message: "删除成功"
//       });
//       handleLoadVersions();
//     }
//   });
//   ipcRenderer.on("Download.importFrpFile.hook", (event, args) => {
//     const { success, data } = args;
//     console.log(args);
//
//     // if (err) {

//     // }
//   });
// };

const handleMirrorChange = () => {
  handleLoadAllVersions();
};

onMounted(() => {
  handleLoadAllVersions();

  on(ipcRouters.VERSION.getVersions, data => {
    console.log("versionData", data);
    versions.value = data.map(m => {
      m.githubCreatedAt = moment(m.githubCreatedAt).format("YYYY-MM-DD");
      return m as FrpcVersion;
    }) as Array<FrpcVersion>;
    loading.value--;
  });

  on(ipcRouters.VERSION.downloadVersion, data => {
    console.log("downloadData", data);
    const { githubReleaseId, completed, percent } = data;
    if (completed) {
      downloading.value.delete(githubReleaseId);
      const version: FrpcVersion | undefined = versions.value.find(
        f => f.githubReleaseId === githubReleaseId
      );
      if (version) {
        version.downloaded = true;
      }
    } else {
      downloading.value.set(
        githubReleaseId,
        Number(Number(percent * 100).toFixed(2))
      );
    }
  });

  on(ipcRouters.VERSION.deleteDownloadedVersion, () => {
    loading.value++;
    ElMessage({
      type: "success",
      message: "删除成功"
    });
    handleLoadAllVersions();
  });

  on(
    ipcRouters.VERSION.importLocalFrpcVersion,
    data => {
      const { canceled } = data;
      if (!canceled) {
        loading.value++;
        ElMessage({
          type: "success",
          message: "导入成功"
        });
        handleLoadAllVersions();
      }
    },
    (bizCode: string, message: string) => {
      if (bizCode === "B1002") {
        // 导入失败，版本已存在
        ElMessageBox.alert(`${message}`, `导入失败`);
      }
      if (bizCode === "B1003") {
        // 所选 frp 架构与操作系统不符
        ElMessageBox.alert(`${message}`, `导入失败`);
      }
      if (bizCode === "B1004") {
        // 无法识别文件
        ElMessageBox.alert(`${message}`, `导入失败`);
      }
    }
  );
});

const handleImportFrp = () => {
  send(ipcRouters.VERSION.importLocalFrpcVersion);
};

onUnmounted(() => {
  removeRouterListeners(ipcRouters.VERSION.deleteDownloadedVersion);
  removeRouterListeners(ipcRouters.VERSION.downloadVersion);
  removeRouterListeners(ipcRouters.VERSION.getVersions);
  removeRouterListeners(ipcRouters.VERSION.importLocalFrpcVersion);
});
</script>
<template>
  <div class="main">
    <!-- <breadcrumb> -->
    <breadcrumb>
      <div class="flex">
        <div class="h-full flex items-center justify-center mr-3">
          <span class="text-sm font-bold">下载源： </span>
          <el-select
            class="w-40"
            v-model="currMirror"
            @change="handleMirrorChange"
          >
            <el-option
              v-for="m in mirrors"
              :label="m.name"
              :key="m.id"
              :value="m.id"
            />
          </el-select>
        </div>
        <el-button type="primary" @click="handleImportFrp">
          <IconifyIconOffline icon="unarchive" />
        </el-button>
      </div>

      <!--      <div-->
      <!--        class="cursor-pointer h-[36px] w-[36px] bg-[#5f3bb0] rounded text-white flex justify-center items-center"-->
      <!--        @click="handleOpenInsert"-->
      <!--      >-->
      <!--        <IconifyIconOffline icon="add" />-->
      <!--      </div>-->
    </breadcrumb>
    <!--    <breadcrumb>-->
    <!--      <div class="flex items-center">-->
    <!--        <el-checkbox>加速下载</el-checkbox>-->
    <!--      </div>-->
    <!--    </breadcrumb>-->
    <div class="app-container-breadcrumb pr-2" v-loading="loading > 0">
      <div class="w-full">
        <template v-if="versions && versions.length > 0">
          <el-row :gutter="15">
            <!--          <el-col :span="24">-->
            <!--            <div class="h2 flex justify-between !mb-[10px]">-->
            <!--              <div>镜像源</div>-->
            <!--            </div>-->
            <!--            &lt;!&ndash;            <div class="!mb-[10px]">&ndash;&gt;-->
            <!--            &lt;!&ndash;              <el-radio-group v-model="currMirror">&ndash;&gt;-->
            <!--            &lt;!&ndash;                <el-radio-button v-for="m in mirrors" :label="m" />&ndash;&gt;-->
            <!--            &lt;!&ndash;              </el-radio-group>&ndash;&gt;-->
            <!--            &lt;!&ndash;            </div>&ndash;&gt;-->
            <!--          </el-col>-->
            <!--          <el-col :span="24">-->
            <!--            <div class="h2 flex justify-between">-->
            <!--              <div>版本选择</div>-->
            <!--            </div>-->
            <!--          </el-col>-->
            <el-col
              v-for="version in versions"
              :key="version.githubAssetId"
              :lg="6"
              :md="8"
              :sm="12"
              :xl="6"
              :xs="12"
              class="mb-[15px]"
            >
              <div
                class="w-full download-card bg-white rounded p-4 drop-shadow flex justify-between items-center animate__animated"
              >
                <div class="left">
                  <div class="mb-2 flex items-center justify-center">
                    <span class="font-bold text-primary mr-2">{{
                      version.name
                    }}</span>
                    <el-tag size="small"> {{ version.size }}</el-tag>
                    <!--              <el-tag class="ml-2">原文件名：{{ version.assets[0]?.name }}</el-tag>-->
                  </div>
                  <div class="text-[12px]">
                    <span class="">下载数：</span>
                    <span class="text-primary font-bold"
                      >{{
                        // moment(version.published_at).format("YYYY-MM-DD HH:mm:ss")
                        version.versionDownloadCount
                      }}
                    </span>
                  </div>
                  <div class="text-[12px]">
                    发布时间：<span class="text-primary font-bold">{{
                      // moment(version.published_at).format("YYYY-MM-DD HH:mm:ss")
                      version.githubCreatedAt
                    }}</span>
                  </div>
                </div>
                <div class="right">
                  <div v-if="version.downloaded">
                    <!--                  <span class="text-[12px] text-primary font-bold mr-2"-->
                    <!--                    >已下载</span-->
                    <!--                  >-->
                    <div>
                      <el-button type="text" size="small">
                        <IconifyIconOffline class="mr-1" icon="check-box" />
                        已下载
                      </el-button>
                    </div>
                    <div>
                      <el-button
                        type="text"
                        size="small"
                        class="danger-text"
                        @click="handleDeleteVersion(version)"
                      >
                        <IconifyIconOffline
                          class="mr-1"
                          icon="delete-rounded"
                        />
                        删 除
                      </el-button>
                    </div>

                    <!--                  <el-button type="text"></el-button>-->
                  </div>

                  <template v-else>
                    <div
                      class="w-32"
                      v-if="downloading.has(version.githubReleaseId)"
                    >
                      <el-progress
                        :percentage="downloading.get(version.githubReleaseId)"
                        :text-inside="false"
                      />
                    </div>
                    <el-button
                      v-else
                      size="small"
                      type="text"
                      @click="handleDownload(version)"
                    >
                      <IconifyIconOffline class="mr-1" icon="download" />
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
          <el-empty description="暂无可用版本" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.download-card {
  border-left: 5px solid #5a3daa;
}

.download-card:hover {
  //animation: pulse 0.5s;
}
</style>
