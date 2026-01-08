import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { IPCChannels } from "../../../electron/core/constant";
import { useDebounceFn } from "@vueuse/core";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import router from "@/router";

export function useLaunch() {
  const { t } = useI18n();
  const frpcDesktopStore = useFrpcDesktopStore();
  const loading = ref(false);

  const handleStartFrpc = () => {
    send(IPCChannels.LAUNCH, {});
  };

  const handleStopFrpc = () => {
    send(IPCChannels.TERMINATE, {});
  };

  const handleButtonClick = useDebounceFn(() => {
    loading.value = true;
    if (frpcDesktopStore.frpcProcessRunning) {
      handleStopFrpc();
    } else {
      handleStartFrpc();
    }
  }, 300);

  /**
   * uptime
   */
  const uptime = computed(() => {
    const uptime = frpcDesktopStore.frpcProcessUptime / 1000;
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    const seconds = Math.ceil(uptime % 60);
    let result = "";
    if (days > 0) {
      result += t("home.uptime.days", { days });
    }
    if (hours > 0) {
      result += t("home.uptime.hours", { hours });
    }
    if (minutes > 0) {
      result += t("home.uptime.minutes", { minutes });
    }
    result += t("home.uptime.seconds", { seconds });
    return result;
  });

  onMounted(() => {
    on(
      IPCChannels.LAUNCH,
      () => {
        frpcDesktopStore.refreshRunning();
        loading.value = false;
      },
      (bizCode: string, message: string) => {
        if (bizCode === "B1001") {
          ElMessageBox.alert(
            t("home.alert.configRequired.message"),
            t("home.alert.configRequired.title"),
            {
              confirmButtonText: t("home.alert.configRequired.confirm")
            }
          ).then(() => {
            router.replace({
              name: "Config"
            });
          });
        } else if (bizCode === "B1005") {
          ElMessageBox.alert(
            t("home.alert.versionNotFound.message"),
            t("home.alert.versionNotFound.title"),
            {
              confirmButtonText: t("home.alert.versionNotFound.confirm")
            }
          ).then(() => {
            router.replace({
              name: "Config"
            });
          });
        } else if (bizCode === "B1006") {
          ElMessageBox.alert(
            t("home.alert.webServerPortInUse.message"),
            t("home.alert.webServerPortInUse.title"),
            {
              confirmButtonText: t("home.alert.webServerPortInUse.confirm")
            }
          ).then(() => {
            router.replace({
              name: "Config"
            });
          });
        }
        loading.value = false;
      }
    );

    on(IPCChannels.TERMINATE, () => {
      frpcDesktopStore.refreshRunning();
      loading.value = false;
    });
  });

  onUnmounted(() => {
    removeRouterListeners(IPCChannels.LAUNCH);
    removeRouterListeners(IPCChannels.TERMINATE);
  });

  return {
    loading,
    handleButtonClick,
    uptime
  };
}
