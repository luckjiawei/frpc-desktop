import { useTunnelStore } from "@/store/tunnel";
import { on, send } from "@/utils/ipcUtils";
import { ElMessage } from "element-plus";
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";

export type TunnelStatusKey = "running" | "error" | "stopped";

/** 实例状态的展示：三态、文案和运行时长（每秒刷新） */
export const useTunnelStatus = () => {
  const tunnelStore = useTunnelStore();
  const { t } = useI18n();
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  });
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  const statusKey = (tunnelId: string): TunnelStatusKey => {
    const status = tunnelStore.statusOf(tunnelId);
    if (!status.running) return "stopped";
    return status.connectionError ? "error" : "running";
  };

  const statusLabel = (tunnelId: string) => {
    const key = statusKey(tunnelId);
    return key === "running"
      ? t("home.status.running")
      : key === "error"
        ? t("home.status.connectionError")
        : t("home.status.disconnected");
  };

  const statusIcon = (tunnelId: string) => {
    const key = statusKey(tunnelId);
    return key === "running"
      ? "check-circle-rounded"
      : key === "error"
        ? "warningRounded"
        : "power-settings-new-rounded";
  };

  const uptimeText = (tunnelId: string) => {
    const lastStartTime = tunnelStore.statusOf(tunnelId).lastStartTime ?? 0;
    const uptime =
      lastStartTime > 0 ? Math.max(0, now.value - lastStartTime) / 1000 : 0;
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    const seconds = Math.ceil(uptime % 60);
    let result = "";
    if (days > 0) result += t("home.uptime.days", { days });
    if (hours > 0) result += t("home.uptime.hours", { hours });
    if (minutes > 0) result += t("home.uptime.minutes", { minutes });
    result += t("home.uptime.seconds", { seconds });
    return result;
  };

  return { statusKey, statusLabel, statusIcon, uptimeText };
};

/** 全部启动 / 全部停止，失败的实例汇总成一条提示 */
export const useBulkLaunch = () => {
  const tunnelStore = useTunnelStore();
  const { t } = useI18n();
  const bulk = reactive({ start: false, stop: false });
  const cleanups: Array<() => void> = [];

  const startAll = () => {
    bulk.start = true;
    send(ipcRouters.LAUNCH.launchAll);
  };

  const stopAll = () => {
    bulk.stop = true;
    send(ipcRouters.LAUNCH.terminateAll);
  };

  onMounted(() => {
    cleanups.push(
      on(
        ipcRouters.LAUNCH.launchAll,
        (data: { failures: Array<{ tunnelId: string; message: string }> }) => {
          bulk.start = false;
          tunnelStore.refreshStatuses();
          const failures = data?.failures ?? [];
          if (failures.length === 0) return;
          const detail = failures
            .map(f => {
              const name =
                tunnelStore.tunnels.find(item => item.id === f.tunnelId)
                  ?.name ?? f.tunnelId;
              return `${name}: ${f.message}`;
            })
            .join("; ");
          ElMessage({
            type: "warning",
            message: t("tunnel.message.launchAllFailed", {
              count: failures.length,
              detail
            }),
            duration: 6000
          });
        },
        (_bizCode: string, message: string) => {
          bulk.start = false;
          ElMessage({ type: "error", message });
        }
      )
    );
    cleanups.push(
      on(
        ipcRouters.LAUNCH.terminateAll,
        () => {
          bulk.stop = false;
          tunnelStore.refreshStatuses();
        },
        (_bizCode: string, message: string) => {
          bulk.stop = false;
          ElMessage({ type: "error", message });
        }
      )
    );
  });

  onUnmounted(() => {
    cleanups.splice(0).forEach(off => off());
  });

  return { bulk, startAll, stopAll };
};
