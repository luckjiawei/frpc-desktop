<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import router from "@/router";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessageBox } from "element-plus";
import { computed, defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";
defineComponent({
  name: "Home"
});

const frpcDesktopStore = useFrpcDesktopStore();
const loading = ref(false);
const { t } = useI18n();

const handleStartFrpc = () => {
  send(ipcRouters.LAUNCH.launch);
};

const handleStopFrpc = () => {
  send(ipcRouters.LAUNCH.terminate);
};

const handleButtonClick = useDebounceFn(() => {
  loading.value = true;
  if (frpcDesktopStore.frpcProcessRunning) {
    handleStopFrpc();
  } else {
    handleStartFrpc();
  }
}, 300);
let uptime = computed(() => {
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
    ipcRouters.LAUNCH.launch,
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
      }
      loading.value = false;
    }
  );

  on(ipcRouters.LAUNCH.terminate, () => {
    frpcDesktopStore.refreshRunning();
    loading.value = false;
  });
});

onUnmounted(() => {
  removeRouterListeners(ipcRouters.LAUNCH.launch);
  removeRouterListeners(ipcRouters.LAUNCH.terminate);
});
</script>

<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <div
        class="flex items-center justify-center w-full h-full p-4 overflow-y-auto bg-white rounded drop-shadow-lg"
      >
        <div class="flex">
          <div
            class="w-52 h-52 border-[#5A3DAA] text-[#5A3DAA] border-4 rounded-full flex justify-center items-center text-[100px] relative"
          >
            <transition name="fade">
              <div
                v-show="frpcDesktopStore.frpcProcessRunning"
                class="z-0 rounded-full opacity-20 left-circle bg-[#5A3DAA] w-full h-full animation-rotate-1"
              />
            </transition>
            <transition name="fade">
              <div
                v-show="frpcDesktopStore.frpcProcessRunning"
                class="z-0 rounded-full opacity-20 right-circle top-[10px] bg-[#5A3DAA] w-full h-full animation-rotate-2"
              />
            </transition>
            <transition name="fade">
              <div
                v-show="frpcDesktopStore.frpcProcessRunning"
                class="z-0 rounded-full opacity-20 top-circle bg-[#5A3DAA] w-full h-full animation-rotate-3"
              />
            </transition>
            <div
              class="absolute z-10 flex items-center justify-center w-full h-full bg-white rounded-full"
            >
              <IconifyIconOffline icon="rocket-launch-rounded" />
            </div>
          </div>
          <div class="flex flex-col items-center justify-center">
            <div class="flex flex-col justify-between pl-10 w-72 h-42">
              <transition name="fade">
                <div class="text-2xl font-bold text-center">
                  <IconifyIconOffline
                    v-if="frpcDesktopStore.frpcProcessRunning"
                    class="text-[#7EC050] inline-block relative top-1"
                    icon="check-circle-rounded"
                  />
                  <IconifyIconOffline
                    v-else
                    class="text-[#E47470] inline-block relative top-1"
                    icon="error"
                  />
                  {{
                    $t("home.status.frpcStatus", {
                      status: frpcDesktopStore.frpcProcessRunning
                        ? $t("home.status.running")
                        : $t("home.status.disconnected")
                    })
                  }}
                </div>
              </transition>
              <div
                class="justify-center w-full mt-2 text-sm text-center animate__animated animate__fadeIn"
                v-if="frpcDesktopStore.frpcProcessRunning"
              >
                <span class="el-text--success">{{
                  $t("home.status.runningTime")
                }}</span>
                <span class="ml-1 font-bold text-primary">{{ uptime }}</span>
              </div>
              <div class="justify-center w-full text-center">
                <el-link
                  v-if="frpcDesktopStore.frpcProcessRunning"
                  class="animate__animated animate__fadeIn"
                  type="primary"
                  @click="$router.replace({ name: 'Logger' })"
                  >{{ $t("home.button.viewLog") }}</el-link
                >
              </div>

              <el-button
                class="mt-4"
                type="primary"
                @click="handleButtonClick"
                :disabled="loading"
                >{{
                  frpcDesktopStore.frpcProcessRunning
                    ? $t("home.button.stop")
                    : $t("home.button.start")
                }}
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes transform-opacity {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 0.3;
  }
}

$offset: 10px;

.animation-rotate-1 {
  animation: rotate 5s linear infinite;
}

.animation-rotate-2 {
  animation: rotate 4s linear infinite;
}

.animation-rotate-3 {
  animation: rotate 6s linear infinite;
}

.top-circle {
  position: absolute;
  bottom: $offset;
  transform-origin: center calc(50% - $offset);
}

.left-circle {
  position: absolute;
  left: $offset;
  top: $offset;
  transform-origin: calc(50% + $offset) center;
}

.right-circle {
  position: absolute;
  right: $offset;
  top: $offset;
  transform-origin: calc(50% - $offset) center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
