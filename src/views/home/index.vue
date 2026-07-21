<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import router from "@/router";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";
defineComponent({
  name: "Home"
});

const frpcDesktopStore = useFrpcDesktopStore();
const loading = ref(false);
const externalActionLoading = ref({
  stop: false,
  importConfig: false
});
const { t } = useI18n();

// Three-state status: "running" | "error" | "stopped"
const frpcStatus = computed(() => {
  if (!frpcDesktopStore.frpcProcessRunning) return "stopped";
  if (frpcDesktopStore.frpcConnectionError) return "error";
  return "running";
});

const externalFrpc = computed(() => frpcDesktopStore.externalFrpcProcess);
const upstreamServerStatuses = computed(
  () => frpcDesktopStore.upstreamServerStatuses
);

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

const handleStopExternalFrpc = useDebounceFn(() => {
  if (!externalFrpc.value) return;
  ElMessageBox.confirm(
    t("home.external.confirmStop.message", { pid: externalFrpc.value.pid }),
    t("home.external.confirmStop.title"),
    {
      confirmButtonText: t("home.external.confirmStop.confirm"),
      cancelButtonText: t("home.external.confirmStop.cancel"),
      type: "warning"
    }
  ).then(() => {
    externalActionLoading.value.stop = true;
    send(ipcRouters.LAUNCH.stopExternal);
  });
}, 300);

const handleImportExternalConfig = useDebounceFn(() => {
  if (!externalFrpc.value?.configPath) return;
  externalActionLoading.value.importConfig = true;
  send(ipcRouters.LAUNCH.importExternalConfig);
}, 300);

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

// Reset loading whenever the running state changes (covers cases where the IPC
// reply is delayed or never arrives, e.g. macOS sudo/osascript flow).
watch(
  () => frpcDesktopStore.frpcProcessRunning,
  () => {
    loading.value = false;
  }
);

onMounted(() => {
  frpcDesktopStore.refreshRunning();

  on(
    ipcRouters.LAUNCH.launch,
    () => {
      frpcDesktopStore.refreshRunning();
      loading.value = false;
    },
    (bizCode: string, message: string) => {
      console.log("bizCode", bizCode);
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

  on(ipcRouters.LAUNCH.terminate, () => {
    frpcDesktopStore.refreshRunning();
    loading.value = false;
  });

  on(
    ipcRouters.LAUNCH.stopExternal,
    () => {
      externalActionLoading.value.stop = false;
      frpcDesktopStore.refreshExternalFrpc();
      ElMessage({
        type: "success",
        message: t("home.external.message.stopSuccess")
      });
    },
    (_bizCode: string, message: string) => {
      externalActionLoading.value.stop = false;
      ElMessage({
        type: "error",
        message
      });
    }
  );

  on(
    ipcRouters.LAUNCH.importExternalConfig,
    data => {
      externalActionLoading.value.importConfig = false;
      frpcDesktopStore.refreshExternalFrpc();
      ElMessage({
        type: "success",
        message: t("home.external.message.importSuccess", {
          proxies: data?.proxies ?? 0
        })
      });
    },
    (_bizCode: string, message: string) => {
      externalActionLoading.value.importConfig = false;
      ElMessage({
        type: "error",
        message
      });
    }
  );
});

onUnmounted(() => {
  removeRouterListeners(ipcRouters.LAUNCH.launch);
  removeRouterListeners(ipcRouters.LAUNCH.terminate);
  removeRouterListeners(ipcRouters.LAUNCH.stopExternal);
  removeRouterListeners(ipcRouters.LAUNCH.importExternalConfig);
});
</script>

<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <div
        class="flex overflow-y-auto flex-col gap-4 justify-center items-center p-4 w-full h-full bg-white rounded drop-shadow-lg"
      >
        <div
          v-if="externalFrpc"
          class="flex gap-3 justify-between items-start p-3 w-full max-w-[720px] rounded border border-[#E6A23C]/40 bg-[#FDF6EC] text-[#7A4D05]"
        >
          <div class="flex gap-2 min-w-0">
            <IconifyIconOffline
              class="shrink-0 mt-0.5 text-xl text-[#E6A23C]"
              icon="warningRounded"
            />
            <div class="min-w-0 text-sm">
              <div class="font-bold">
                {{ t("home.external.title", { pid: externalFrpc.pid }) }}
              </div>
              <div class="mt-1 leading-5 break-all">
                {{ externalFrpc.configPath || t("home.external.noConfigPath") }}
              </div>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <el-button
              size="small"
              type="warning"
              plain
              :loading="externalActionLoading.stop"
              @click="handleStopExternalFrpc"
            >
              <IconifyIconOffline class="mr-1" icon="cancel-presentation" />
              {{ t("home.external.stop") }}
            </el-button>
            <el-button
              size="small"
              type="primary"
              :disabled="!externalFrpc.configPath"
              :loading="externalActionLoading.importConfig"
              @click="handleImportExternalConfig"
            >
              <IconifyIconOffline class="mr-1" icon="file-open-rounded" />
              {{ t("home.external.importConfig") }}
            </el-button>
          </div>
        </div>
        <div class="flex">
          <div
            class="w-52 h-52 !border-4 border-[#5A3DAA] text-[#5A3DAA] rounded-full flex justify-center items-center text-[100px] relative"
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
              class="flex absolute z-10 justify-center items-center w-full h-full bg-white rounded-full"
            >
              <IconifyIconOffline icon="rocket-launch-rounded" />
            </div>
          </div>
          <div class="flex flex-col justify-center items-center">
            <div class="flex flex-col gap-4 justify-between pl-10 w-96">
              <transition name="fade">
                <div
                  class="flex gap-1 justify-center text-2xl font-bold text-center"
                >
                  <IconifyIconOffline
                    v-if="frpcStatus === 'running'"
                    class="text-[#7EC050] inline-block relative top-1"
                    icon="check-circle-rounded"
                  />
                  <IconifyIconOffline
                    v-else-if="frpcStatus === 'error'"
                    class="text-[#E6A23C] inline-block relative top-1"
                    icon="warningRounded"
                  />
                  <IconifyIconOffline
                    v-else
                    class="text-[#E47470] inline-block relative top-1"
                    icon="error"
                  />
                  <span>
                    {{
                      $t("home.status.frpcStatus", {
                        status:
                          frpcStatus === "running"
                            ? $t("home.status.running")
                            : frpcStatus === "error"
                              ? $t("home.status.connectionError")
                              : $t("home.status.disconnected")
                      })
                    }}
                  </span>
                </div>
              </transition>
              <div
                v-if="frpcStatus === 'error'"
                class="justify-center w-full text-sm text-center animate__animated animate__fadeIn"
              >
                <el-text
                  class="break-all line-clamp-2 text-primary"
                  :title="frpcDesktopStore.frpcConnectionError"
                >
                  {{ frpcDesktopStore.frpcConnectionError }}
                </el-text>
                <div class="mt-1">
                  <el-link
                    type="primary"
                    @click="$router.replace({ name: 'Logger' })"
                  >
                    {{ $t("home.button.viewLog") }}
                  </el-link>
                </div>
              </div>
              <div
                v-else-if="frpcStatus === 'running'"
                class="justify-center w-full text-sm text-center animate__animated animate__fadeIn"
              >
                <span class="el-text--success">{{
                  $t("home.status.runningTime")
                }}</span>
                <span class="ml-1 font-bold text-primary">{{ uptime }}</span>

                <div class="justify-center w-full text-center">
                  <el-link
                    class="animate__animated animate__fadeIn"
                    type="primary"
                    @click="$router.replace({ name: 'Logger' })"
                    >{{ $t("home.button.viewLog") }}</el-link
                  >
                </div>
              </div>

              <el-button
                class="mt-4"
                type="primary"
                :disabled="loading"
                @click="handleButtonClick"
                >{{
                  frpcDesktopStore.frpcProcessRunning
                    ? $t("home.button.stop")
                    : $t("home.button.start")
                }}
              </el-button>
            </div>
          </div>
        </div>
        <div class="w-full max-w-[720px]">
          <div class="mb-2 text-sm font-bold text-primary">
            {{ t("home.upstream.title") }}
          </div>
          <div
            v-if="upstreamServerStatuses.length > 0"
            class="grid gap-2 md:grid-cols-2"
          >
            <div
              v-for="server in upstreamServerStatuses"
              :key="server.serverId"
              class="p-3 rounded border border-gray-200 bg-white"
            >
              <div class="flex gap-2 justify-between items-start min-w-0">
                <div class="min-w-0">
                  <div class="flex gap-2 items-center min-w-0">
                    <span class="font-bold truncate">{{ server.name }}</span>
                    <el-tag v-if="server.isDefault" size="small">
                      {{ t("config.server.defaultTag") }}
                    </el-tag>
                  </div>
                  <div class="mt-1 text-xs text-gray-500 break-all">
                    {{ server.serverAddr || "-" }}:{{
                      server.serverPort || "-"
                    }}
                  </div>
                  <div
                    v-if="server.pid"
                    class="mt-1 text-xs text-gray-500 break-all"
                  >
                    PID: {{ server.pid }}
                  </div>
                  <div
                    v-if="server.connectionError"
                    class="mt-1 text-xs leading-5 break-all text-[#E6A23C]"
                  >
                    {{ server.connectionError }}
                  </div>
                </div>
                <el-tag
                  class="shrink-0"
                  :type="server.running ? 'success' : 'info'"
                  size="small"
                >
                  {{
                    server.running
                      ? t("home.status.running")
                      : t("home.status.disconnected")
                  }}
                </el-tag>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500">
            {{ t("home.upstream.empty") }}
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
