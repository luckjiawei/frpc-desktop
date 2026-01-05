import { onEvent } from "@/utils/ipcUtils";
import { ResponseCode } from "../../electron/core/constant";
import { defineStore } from "pinia";


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
      onEvent("systemUsage", r => {
        const { code, data } = r;
        if (code === ResponseCode.SUCCESS.code) {
          this.cpu = data.cpu;
          this.memory = data.memory;
        }
      });
    }
  }
});
