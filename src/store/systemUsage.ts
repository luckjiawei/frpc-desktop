import { onListener } from "@/utils/ipcUtils";
import { defineStore } from "pinia";
import { listeners } from "@/core/IpcRouter";

export const useSystemUsageStore = defineStore("systemUsage", {
  state: () => ({
    cpu: 0,
    memory: {
      used: 0,
      percentage: 0
    }
  }),
  getters: {
    systemUsageCpu: state => {
      const val =
        typeof state.cpu === "number" ? state.cpu : Number(state.cpu) || 0;
      return val.toFixed(2);
    },
    systemUsageMemory: state => state.memory,
    formattedMemory: state => {
      const usedMb = state.memory?.used || 0;
      if (usedMb >= 1024) {
        return `${(usedMb / 1024).toFixed(2)} GB`;
      }
      return `${usedMb} MB`;
    }
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
