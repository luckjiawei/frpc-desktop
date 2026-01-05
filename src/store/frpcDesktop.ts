import i18n from "@/lang";
import { on, onEvent, send } from "@/utils/ipcUtils";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import pkg from "../../package.json";
import { EventChannels, IPCChannels } from "../../electron/core/constant";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({
    running: false,
    uptime: -1,
    versions: [],
    lastRelease: null,
    language: null
  }),
  getters: {
    frpcProcessRunning: state => state.running,
    frpcProcessUptime: state => state.uptime,
    downloadedVersions: state => state.versions,
    frpcDesktopLastRelease: state => state.lastRelease,
    frpcDesktopLanguage: state => state.language
  },
  actions: {
    onListenerFrpcProcessRunning() {
      onEvent(EventChannels.FRPC_PROCESS_STATUS, data => {
        const { running, lastStartTime } = data;
        this.running = running;
        if (running) {
          this.uptime = new Date().getTime() - lastStartTime;
        }
      });
    },

    onListenerDownloadedVersion() {
      on(IPCChannels.VERSION_GET_DOWNLOADED_VERSIONS, data => {
        this.versions = data;
      });
    },

    onListenerFrpcDesktopGithubLastRelease() {
      on(IPCChannels.SYSTEM_GET_FRPC_DESKTOP_GITHUB_LAST_RELEASE, data => {
        const { manual, version } = data;
        this.lastRelease = version;

        if (!version) {
          if (manual) {
            ElMessage({
              message: i18n.global.t("about.message.checkVersionFailed"),
              type: "warning"
            });
          }
          return;
        }

        // Check if this is the latest version
        const tagName = version["tag_name"];
        if (!tagName) {
          return;
        }

        const lastVersion = tagName.replace("v", "").toString();
        const currVersion = pkg.version;
        const isLastVersion = currVersion >= lastVersion;

        if (!isLastVersion && manual) {
          // Show update notification
          let content = version.body || "";
          content = content.replaceAll("\n", "<br/>");
          ElMessageBox.alert(
            content,
            `🎉 ${i18n.global.t("about.message.newVersionFound")} ${version.name}`,
            {
              showCancelButton: true,
              cancelButtonText: i18n.global.t("common.close"),
              dangerouslyUseHTMLString: true,
              confirmButtonText: i18n.global.t("about.button.download")
            }
          ).then(() => {
            send(IPCChannels.SYSTEM_OPEN_URL, {
              url: version["html_url"]
            });
          }).catch(() => {
            // User cancelled
          });
        } else if (isLastVersion && manual) {
          ElMessage({
            message: i18n.global.t("about.message.alreadyLatest"),
            type: "success"
          });
        }
      });
    },

    refreshDownloadedVersion() {
      send(IPCChannels.VERSION_GET_DOWNLOADED_VERSIONS);
    },

    refreshRunning() {
      send(EventChannels.FRPC_PROCESS_STATUS);
    },

    checkNewVersion(manual: boolean) {
      send(IPCChannels.SYSTEM_GET_FRPC_DESKTOP_GITHUB_LAST_RELEASE, {
        manual: manual
      });
    },
    onListenerFrpcDesktopLanguage() {
      on(IPCChannels.CONFIG_GET_LANGUAGE, data => {
        this.language = data;
        i18n.global.locale = data;
      });
    },
    getLanguage() {
      send(IPCChannels.CONFIG_GET_LANGUAGE);
    }
  }
});
