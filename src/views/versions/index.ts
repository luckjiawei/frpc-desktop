import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useClipboard, useDebounceFn } from "@vueuse/core";
import { IPCChannels } from "../../../electron/core/constant";
import { ElMessage, ElMessageBox } from "element-plus";
import moment from "moment";
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";

export function useVersions() {
  const { t } = useI18n();

  const versions = ref<Array<FrpcDesktopVersion>>([]);
  const loading = ref(1);
  const downloadPercentage = ref(0);
  const downloading = ref<Map<number, number>>(new Map<number, number>());
  const currMirror = ref("github");
  // const mirrors = ref<Array<GitHubMirror>>([
  //     {
  //         id: "github",
  //         name: "github"
  //     }
  // ]);
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
  const handleDownload = useDebounceFn((version: FrpcDesktopVersion) => {
    send(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, {
      githubReleaseId: version.githubReleaseId
    });
    downloading.value.set(version.githubReleaseId, 0);
  }, 300);

  /**
   * copy download link
   * @param version
   */
  const handleCopyDownloadLink = useDebounceFn(
    (version: FrpcDesktopVersion) => {
      const { copy } = useClipboard();
      copy(version.browserDownloadUrl);
      ElMessage({
        type: "success",
        message: t("download.message.copyDownloadLinkSuccess")
      });
    },
    300
  );

  /**
   * delete versions
   * @param version
   */
  const handleDeleteVersion = useDebounceFn((version: FrpcDesktopVersion) => {
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
        githubReleaseId: version.githubReleaseId
      });
    });
  }, 300);

  const handleMirrorChange = () => {
    handleLoadAllVersions();
  };

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

  onMounted(() => {
    handleLoadAllVersions();

    on(
      IPCChannels.VERSION_GET_VERSIONS,
      data => {
        versions.value = data.map(m => {
          m.githubCreatedAt = moment(m.githubCreatedAt).format("YYYY-MM-DD");
          return m as FrpcDesktopVersion;
        }) as Array<FrpcDesktopVersion>;
        loading.value--;
      },
      (code, message) => {
        ElMessage({
          message: message,
          type: "error"
        });
        loading.value--;
      }
    );

    on(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION, data => {
      const { githubReleaseId, completed, percent } = data;
      if (completed) {
        downloading.value.delete(githubReleaseId);
        const version: FrpcDesktopVersion | undefined = versions.value.find(
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
      (bizCode: string) => {
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

  onUnmounted(() => {
    removeRouterListeners(IPCChannels.VERSION_DELETE_DOWNLOADED_VERSION);
    removeRouterListeners(IPCChannels.VERSION_DOWNLOAD_FRP_VERSION);
    removeRouterListeners(IPCChannels.VERSION_GET_VERSIONS);
    removeRouterListeners(IPCChannels.VERSION_IMPORT_LOCAL_FRPC_VERSION);
  });

  return {
    t,
    versions,
    loading,
    downloadPercentage,
    downloading,
    currMirror,
    // mirrors,
    handleLoadAllVersions,
    handleDownload,
    handleCopyDownloadLink,
    handleDeleteVersion,
    handleMirrorChange,
    handleImportFrp
  };
}
