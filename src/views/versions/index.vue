<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";

import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useClipboard, useDebounceFn } from "@vueuse/core";
import { IPCChannels, ResponseCode } from "../../../electron/core/constant";
import { ElMessage, ElMessageBox } from "element-plus";
import moment from "moment";
import { defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";

defineComponent({
  name: "Versions"
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
  send(IPCChannels.VERSION_GET_VERSIONS, {});
};

/**
 * download
 * @param version
 */
const handleDownload = useDebounceFn((version: FrpcVersion) => {
  send(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, {
    github_asset_id: version.github_asset_id
  });
  downloading.value.set(version.github_asset_id, 0);
}, 300);

/**
 * copy download link
 * @param version
 */
const handleCopyDownloadLink = useDebounceFn((version: FrpcVersion) => {
  const { copy, copied } = useClipboard();
  copy(version.browser_download_url);
  ElMessage({
    type: "success",
    message: t("download.message.copyDownloadLinkSuccess")
  });
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
    send(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION, {
      githubReleaseId: version.github_release_id
    });
  });
}, 300);

const handleMirrorChange = () => {
  handleLoadAllVersions();
};

onMounted(() => {
  handleLoadAllVersions();

  on(IPCChannels.VERSION_GET_VERSIONS, data => {
    versions.value = data.map(m => {
      m.githubCreatedAt = moment(m.githubCreatedAt).format("YYYY-MM-DD");
      return m as FrpcVersion;
    }) as Array<FrpcVersion>;
    loading.value--;
  });

  on(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, data => {
    const { githubReleaseId, completed, percent } = data;
    if (completed) {
      downloading.value.delete(githubReleaseId);
      const version: FrpcVersion | undefined = versions.value.find(
        f => f.github_asset_id === githubReleaseId
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
    // frpcDesktopStore.refreshDownloadedVersion();
  });

  on(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION, () => {
    loading.value++;
    ElMessage({
      type: "success",
      message: t("download.message.deleteSuccess")
    });
    handleLoadAllVersions();
    frpcDesktopStore.refreshDownloadedVersion();
  });

  on(
    IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION,
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
  ElMessageBox.alert(
    '仅支持导入版本 > <span class="font-bold text-primary">v0.52.0</span> <= <span class="font-bold text-primary">v0.64.0</span><div class="font-bold text-primary">导入文件不要解压！！！',
    "导入提示",
    {
      confirmButtonText: "知道了",
      dangerouslyUseHTMLString: true
    }
  ).then(() => {
    send(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION);
  });
};

onUnmounted(() => {
  removeRouterListeners(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION);
  removeRouterListeners(IPCChannels.VERSION_DOWNLOAD_VERSION);
  removeRouterListeners(IPCChannels.VERSION_GET_VERSIONS);
  removeRouterListeners(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION);
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
    <div v-loading="loading > 0" class="pr-2 app-container-breadcrumb">
      <div class="w-full">
        <template v-if="versions && versions.length > 0">
          <el-row :gutter="15">
            <el-col
              v-for="version in versions"
              :key="version.github_asset_id"
              :lg="6"
              :md="8"
              :sm="12"
              :xl="6"
              :xs="12"
              class="mb-[15px]"
            >
              <div
                class="flex justify-between items-center p-4 w-full bg-white rounded drop-shadow left-border animate__animated"
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
                      version.version_download_count
                    }}</span>
                  </div>
                  <div class="text-[12px]">
                    {{ t("download.version.publishTime")
                    }}<span class="font-bold text-primary">{{
                      version.github_created_at
                    }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 items-end right">
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
                      v-if="downloading.has(version.github_release_id)"
                      class="w-32"
                    >
                      <el-progress
                        :percentage="downloading.get(version.github_release_id)"
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

                    <el-button
                      type="text"
                      size="small"
                      @click="handleCopyDownloadLink(version)"
                    >
                      <template #icon>
                        <IconifyIconOffline icon="link" /> </template
                      >{{ t("download.version.downloadLink") }}
                    </el-button>
                  </template>
                </div>
              </div>
            </el-col>
          </el-row>
        </template>
        <div
          v-else
          class="flex overflow-hidden justify-center items-center p-2 w-full h-full bg-white rounded drop-shadow-xl"
        >
          <el-empty :description="t('download.version.noVersions')" />
        </div>
      </div>
    </div>
  </div>
</template>
