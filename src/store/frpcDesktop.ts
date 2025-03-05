import { defineStore } from "pinia";
import { on, onListener, send } from "@/utils/ipcUtils";
import { ipcRouters, listeners } from "../../electron/core/IpcRouter";
import { ElMessage, ElMessageBox } from "element-plus";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({
    running: false,
    uptime: -1,
    versions: [],
    lastRelease: null
  }),
  getters: {
    frpcProcessRunning: state => state.running,
    frpcProcessUptime: state => state.uptime,
    downloadedVersions: state => state.versions,
    frpcDesktopLastRelease: state => state.lastRelease
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
        this.lastRelease = data;
        if (!this.lastReleaseVersion) {
          let content = this.lastRelease.body;
          content = content.replaceAll("\n", "<br/>");
          ElMessageBox.alert(content, `🎉 发现新版本 ${data.name}`, {
            showCancelButton: true,
            cancelButtonText: "关闭",
            dangerouslyUseHTMLString: true,
            confirmButtonText: "去下载"
          }).then(() => {
            send(ipcRouters.SYSTEM.openUrl, {
              url: this.lastRelease["html_url"]
            });
          });
        } else {
          ElMessage({
            message: "当前已是最新版本",
            type: "success"
          });
        }
      });
    },
    checkNewVersion() {
      send(ipcRouters.SYSTEM.getFrpcDesktopGithubLastRelease);
    }
  }
});
