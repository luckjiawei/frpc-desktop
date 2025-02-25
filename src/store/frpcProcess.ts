import { defineStore } from "pinia";
import { send } from "@/utils/ipcUtils";
import { ipcRouters } from "../../electron/core/IpcRouter";

export const useFrpcProcessStore = defineStore("frpcProcess", {
  state: () => ({ isRunning: false }),
  getters: {
    running: state => state.isRunning
  },
  actions: {
    setRunning(running: boolean) {
      this.isRunning = running;
    },
    refreshRunning() {
      send(ipcRouters.LAUNCH.getStatus);
    }
  }
});
