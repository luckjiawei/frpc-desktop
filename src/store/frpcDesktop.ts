import { defineStore } from "pinia";
import { on, onListener, send } from "@/utils/ipcUtils";
import { ipcRouters, listeners } from "../../electron/core/IpcRouter";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({ isRunning: false, versions: [] }),
  getters: {
    running: state => state.isRunning,
    downloadedVersions: state => state.versions
  },
  actions: {
    onListenerFrpcProcessRunning() {
      onListener(listeners.watchFrpcProcess, data => {
        console.log("watchFrpcProcess", data);
        this.isRunning = data;
      });

      on(ipcRouters.LAUNCH.getStatus, data => {
        console.log("getStatus", data);
        this.isRunning = data;
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
