<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";

import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage, ElMessageBox } from "element-plus";
import moment from "moment";
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";

defineComponent({
  name: "Download"
});

const { t } = useI18n();

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
const frpcDesktopStore = useFrpcDesktopStore();

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
    t("download.alert.deleteConfirm.message", { name: version.name }),
    t("download.alert.deleteConfirm.title"),
    {
      showCancelButton: true,
      cancelButtonText: t("download.alert.deleteConfirm.cancel"),
      dangerouslyUseHTMLString: true,
      confirmButtonText: t("download.alert.deleteConfirm.confirm")
    }
  ).then(() => {
    send(ipcRouters.VERSION.deleteDownloadedVersion, {
      githubReleaseId: version.githubReleaseId
    });
  });
}, 300);

const handleMirrorChange = () => {
  handleLoadAllVersions();
};

onMounted(() => {
  handleLoadAllVersions();

  on(ipcRouters.VERSION.getVersions, data => {
    versions.value = data.map(m => {
      m.githubCreatedAt = moment(m.githubCreatedAt).format("YYYY-MM-DD");
      return m as FrpcVersion;
    }) as Array<FrpcVersion>;
    loading.value--;
  });

  on(ipcRouters.VERSION.downloadVersion, data => {
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
    frpcDesktopStore.refreshDownloadedVersion();
  });

  on(ipcRouters.VERSION.deleteDownloadedVersion, () => {
    loading.value++;
    ElMessage({
      type: "success",
      message: t("download.message.deleteSuccess")
    });
    handleLoadAllVersions();
    frpcDesktopStore.refreshDownloadedVersion();
  });

  on(
    ipcRouters.VERSION.importLocalFrpcVersion,
    data => {
      const { canceled } = data;
      if (!canceled) {
        loading.value++;
        ElMessage({
          type: "success",
          message: t("download.message.importSuccess")
        });
        handleLoadAllVersions();
        frpcDesktopStore.refreshDownloadedVersion();
      }
    },
    (bizCode: string, message: string) => {
      if (bizCode === "B1002") {
        ElMessageBox.alert(
          t("download.alert.importFailed.versionExists"),
          t("download.alert.importFailed.title")
        );
      }
      if (bizCode === "B1003") {
        ElMessageBox.alert(
          t("download.alert.importFailed.architectureNotMatch"),
          t("download.alert.importFailed.title")
        );
      }
      if (bizCode === "B1004") {
        ElMessageBox.alert(
          t("download.alert.importFailed.unrecognizedFile"),
          t("download.alert.importFailed.title")
        );
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
    <breadcrumb>
      <div class="flex">
        <el-button type="primary" @click="handleImportFrp">
          <template #icon>
            <IconifyIconOffline icon="unarchive" />
          </template>
          {{ t("download.button.import") }}
        </el-button>
      </div>
    </breadcrumb>
    <div class="pr-2 app-container-breadcrumb" v-loading="loading > 0">
      <div class="w-full">
        <template v-if="versions && versions.length > 0">
          <el-row :gutter="15">
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
                class="flex items-center justify-between w-full p-4 bg-white rounded left-border drop-shadow animate__animated"
              >
                <div class="left">
                  <div class="flex items-center">
                    <span class="mr-2 font-bold text-primary">{{
                      version.name
                    }}</span>
                  </div>
                  <div class="mb-1">
                    <el-tag size="small"> {{ version.size }}</el-tag>
                  </div>
                  <div class="text-[12px]">
                    <span class="">{{
                      t("download.version.downloadCount")
                    }}</span>
                    <span class="font-bold text-primary">{{
                      version.versionDownloadCount
                    }}</span>
                  </div>
                  <div class="text-[12px]">
                    {{ t("download.version.publishTime")
                    }}<span class="font-bold text-primary">{{
                      version.githubCreatedAt
                    }}</span>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1 right">
                  <template v-if="version.downloaded">
                    <el-button type="text" size="small">
                      <template #icon>
                        <IconifyIconOffline icon="check-box" />
                      </template>
                      {{ t("download.version.downloaded") }}
                    </el-button>
                    <el-button
                      type="text"
                      size="small"
                      class="danger-text"
                      @click="handleDeleteVersion(version)"
                    >
                      <template #icon>
                        <IconifyIconOffline icon="delete-rounded" />
                      </template>
                      {{ t("common.delete") }}
                    </el-button>
                  </template>

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
                      <template #icon>
                        <IconifyIconOffline icon="download" />
                      </template>
                      {{ t("download.version.download") }}
                    </el-button>
                  </template>
                </div>
              </div>
            </el-col>
          </el-row>
        </template>
        <div
          v-else
          class="flex items-center justify-center w-full h-full p-2 overflow-hidden bg-white rounded drop-shadow-xl"
        >
          <el-empty :description="t('download.version.noVersions')" />
        </div>
      </div>
    </div>
  </div>
</template>
