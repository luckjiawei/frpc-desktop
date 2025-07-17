import i18n from "@/lang";
import { on, onListener, send } from "@/utils/ipcUtils";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import { ipcRouters, listeners } from "../../electron/core/IpcRouter";
import pkg from "../../package.json";

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
      onListener(listeners.watchFrpcProcess, data => {
        const { running, lastStartTime } = data;
        this.running = running;
        if (running) {
          this.uptime = new Date().getTime() - lastStartTime;
        }
      });

      on(ipcRouters.LAUNCH.getStatus, data => {
        const { running, lastStartTime } = data;
        this.running = running;
        if (running) {
          this.uptime = new Date().getTime() - lastStartTime;
        }
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
