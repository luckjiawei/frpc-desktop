import i18n from "@/lang";
import { on, onListener, send } from "@/utils/ipcUtils";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import { ipcRouters, listeners } from "../../electron/core/IpcRouter";
import pkg from "../../package.json";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({
    running: false,
    lastStartTime: -1,
    versions: [],
    lastRelease: null,
    language: null,
    connectionError: null as string | null
  }),
  getters: {
    frpcProcessRunning: state => state.running,
    frpcProcessLastStartTime: state => state.lastStartTime,
    frpcConnectionError: state => state.connectionError,
    downloadedVersions: state => state.versions,
    frpcDesktopLastRelease: state => state.lastRelease,
    frpcDesktopLanguage: state => state.language
  },
  actions: {
    applyFrpcProcessStatus(data: FrpcProcessStatus) {
      const { running, lastStartTime, connectionError } = data;
      if (this.running !== running) {
        this.running = running;
      }
      const nextConnectionError = connectionError ?? null;
      if (this.connectionError !== nextConnectionError) {
        this.connectionError = nextConnectionError;
      }
      if (lastStartTime !== undefined && this.lastStartTime !== lastStartTime) {
        this.lastStartTime = lastStartTime;
      }
      if (!running && lastStartTime !== undefined) {
        this.lastStartTime = -1;
      }
    },
    onListenerFrpcProcessRunning() {
      onListener(listeners.watchFrpcProcess, data => {
        this.applyFrpcProcessStatus(data);
      });

      on(ipcRouters.LAUNCH.getStatus, data => {
        this.applyFrpcProcessStatus(data);
      });
    },

    onListenerDownloadedVersion() {
      on(ipcRouters.VERSION.getDownloadedVersions, data => {
        this.versions = data;
      });
    },
    refreshRunning() {
      send(ipcRouters.LAUNCH.getStatus);
    },
    refreshDownloadedVersion() {
      send(ipcRouters.VERSION.getDownloadedVersions);
    },
    onListenerFrpcDesktopGithubLastRelease(sd?: false) {
      on(ipcRouters.SYSTEM.getFrpcDesktopGithubLastRelease, data => {
        const { manual, version } = data;
        this.lastRelease = version;
        // tagName相对固定
        const tagName = this.lastRelease["tag_name"];
        let lastReleaseVersion = true;
        if (!tagName) {
          // new
          lastReleaseVersion = false;
        }
        // 最后版本号
        const lastVersion = tagName.replace("v", "").toString();
        const currVersion = pkg.version;
        lastReleaseVersion = currVersion >= lastVersion;
        // return false;
        if (!lastReleaseVersion) {
          let content = this.lastRelease.body;
          content = content.replaceAll("\n", "<br/>");
          ElMessageBox.alert(
            content,
            `🎉 发现新版本 ${this.lastRelease.name}`,
            {
              showCancelButton: true,
              cancelButtonText: "关闭",
              dangerouslyUseHTMLString: true,
              confirmButtonText: "去下载"
            }
          ).then(() => {
            send(ipcRouters.SYSTEM.openUrl, {
              url: this.lastRelease["html_url"]
            });
          });
        } else {
          if (manual) {
            ElMessage({
              message: "当前已是最新版本",
              type: "success"
            });
          }
        }
      });
    },
    checkNewVersion(manual: boolean) {
      send(ipcRouters.SYSTEM.getFrpcDesktopGithubLastRelease, {
        manual: manual
      });
    },
    onListenerFrpcDesktopLanguage() {
      on(ipcRouters.SERVER.getLanguage, data => {
        this.language = data;
        i18n.global.locale = data;
      });
    },
    getLanguage() {
      send(ipcRouters.SERVER.getLanguage);
    }
  }
});
