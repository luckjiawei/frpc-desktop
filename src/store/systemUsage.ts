import { onListener } from "@/utils/ipcUtils";
import { defineStore } from "pinia";
import { ipcRouters, listeners } from "../../electron/core/IpcRouter";


export const useSystemUsageStore = defineStore("systemUsage", {
  state: () => ({
    cpu: 0,
    memory: {
      used: 0,
      percentage: 0
    }
  }),
  getters: {
    systemUsageCpu: state => state.cpu,
    systemUsageMemory: state => state.memory
  },
  actions: {
    onListenerSystemUsage() {
      onListener(listeners.watchSystemUsage, data => {
        this.cpu = data.cpu;
        this.memory = data.memory;
      });
    }
  }
});
