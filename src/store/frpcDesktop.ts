import { defineStore } from "pinia";
import { on, onListener, send } from "@/utils/ipcUtils";
import { ipcRouters, listeners } from "../../electron/core/IpcRouter";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({ running: false, uptime: -1, versions: [] }),
  getters: {
    frpcProcessRunning: state => state.running,
    frpcProcessUptime: state => state.uptime,
    downloadedVersions: state => state.versions
  },
  actions: {
    onListenerFrpcProcessRunning() {
      onListener(listeners.watchFrpcProcess, data => {
        const { running, lastStartTime } = data;
        this.running = running;
        if (running) {
          this.uptime = new Date().getTime() - lastStartTime
        }
      });

      on(ipcRouters.LAUNCH.getStatus, data => {
        const { running, lastStartTime } = data;
        this.running = running;
        if (running) {
          this.uptime = new Date().getTime() - lastStartTime
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
    }
  }
});
