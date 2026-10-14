import { ipcRouters, listeners } from "@/core/IpcRouter";
import { on, onListener, send } from "@/utils/ipcUtils";
import { defineStore } from "pinia";

export const DEFAULT_TUNNEL_ID = "1";
const CURRENT_TUNNEL_STORAGE_KEY = "frpc-desktop.currentTunnelId";

const readStoredTunnelId = () => {
  try {
    return (
      localStorage.getItem(CURRENT_TUNNEL_STORAGE_KEY) || DEFAULT_TUNNEL_ID
    );
  } catch {
    return DEFAULT_TUNNEL_ID;
  }
};

export const useTunnelStore = defineStore("tunnel", {
  state: () => ({
    tunnels: [] as TunnelSummary[],
    statuses: {} as Record<string, TunnelStatus>,
    /** 代理、设置、日志页面当前操作的实例 */
    currentTunnelId: readStoredTunnelId(),
    loaded: false
  }),
  getters: {
    currentTunnel: state =>
      state.tunnels.find(t => t.id === state.currentTunnelId) ?? null,
    anyRunning: state => Object.values(state.statuses).some(s => s.running),
    hasMultiple: state => state.tunnels.length > 1
  },
  actions: {
    statusOf(tunnelId: string): TunnelStatus {
      return (
        this.statuses[tunnelId] ?? {
          tunnelId,
          provider: "frpc",
          running: false,
          connectionError: null,
          lastStartTime: null
        }
      );
    },
    applyStatus(status: TunnelStatus) {
      if (!status?.tunnelId) return;
      this.statuses[status.tunnelId] = status;
    },
    setCurrentTunnel(tunnelId: string) {
      this.currentTunnelId = tunnelId;
      try {
        localStorage.setItem(CURRENT_TUNNEL_STORAGE_KEY, tunnelId);
      } catch {
        // localStorage 不可用时仅在本次会话内生效
      }
    },
    init() {
      onListener(listeners.watchTunnelStatus, (data: TunnelStatus) => {
        this.applyStatus(data);
      });
      on(ipcRouters.LAUNCH.getStatuses, (data: TunnelStatus[]) => {
        (data || []).forEach(s => this.applyStatus(s));
      });
      on(ipcRouters.TUNNEL.list, (data: TunnelSummary[]) => {
        this.tunnels = data || [];
        this.loaded = true;
        const ids = new Set(this.tunnels.map(t => t.id));
        Object.keys(this.statuses).forEach(id => {
          if (!ids.has(id)) delete this.statuses[id];
        });
        if (!ids.has(this.currentTunnelId)) {
          this.setCurrentTunnel(DEFAULT_TUNNEL_ID);
        }
      });
      this.refreshTunnels();
      this.refreshStatuses();
    },
    refreshTunnels() {
      send(ipcRouters.TUNNEL.list);
    },
    refreshStatuses() {
      send(ipcRouters.LAUNCH.getStatuses);
    }
  }
});
