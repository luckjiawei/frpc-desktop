<script lang="ts" setup>
import { computed, defineComponent, onMounted, onUnmounted, ref } from "vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useDebounceFn } from "@vueuse/core";
import { on, removeRouterListeners, send } from "@/utils/ipcUtils";
import { ipcRouters } from "../../../electron/core/IpcRouter";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { ElMessageBox } from "element-plus";
import router from "@/router";

defineComponent({
  name: "Home"
});

const frpcDesktopStore = useFrpcDesktopStore();

// const running = ref(false);
const loading = ref(false);

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
    result += `${days}天`;
  }
  if (hours > 0) {
    result += `${hours}小时`;
  }
  if (minutes > 0) {
    result += `${minutes}分钟`;
  }
  result += `${seconds}秒`;
  return result;
});

onMounted(() => {
  on(
    ipcRouters.LAUNCH.launch,
    () => {
      // send(ipcRouters.LAUNCH.getStatus);
      frpcDesktopStore.refreshRunning();
      loading.value = false;
    },
    (bizCode: string, message: string) => {
      if (bizCode === "B1001") {
        ElMessageBox.alert("请先前往设置页面，修改配置后再启动", "提示", {
          // showCancelButton: true,
          // cancelButtonText: "取消",
          confirmButtonText: "去设置"
        }).then(() => {
          router.replace({
            name: "Config"
          });
        });
      }
      loading.value = false;
    }
  );

  on(ipcRouters.LAUNCH.terminate, () => {
    // send(ipcRouters.LAUNCH.getStatus);
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
        class="w-full h-full bg-white p-4 rounded drop-shadow-lg overflow-y-auto flex justify-center items-center"
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
              class="bg-white z-10 w-full h-full absolute rounded-full flex justify-center items-center"
            >
              <IconifyIconOffline icon="rocket-launch-rounded" />
            </div>
          </div>
          <div class="flex flex-col justify-center items-center">
            <div class="pl-10 h-42 w-64 flex flex-col justify-between">
              <transition name="fade">
                <div class="font-bold text-2xl text-center">
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
                  Frpc
                  {{
                    frpcDesktopStore.frpcProcessRunning ? "已启动" : "已断开"
                  }}
                </div>
              </transition>
              <!--              <el-button-->
              <!--                  class="block"-->
              <!--                  type="text"-->
              <!--                  v-if="running"-->
              <!--                  @click="$router.replace({ name: 'Logger' })"-->
              <!--              >查看日志-->
              <!--              </el-button>-->
              <div
                class="w-full justify-center text-center mt-2 text-sm animate__animated animate__fadeIn"
                v-if="frpcDesktopStore.frpcProcessRunning"
              >
                <span class="el-text--success">已运行</span>
                <span class="text-primary font-bold">{{ uptime }}</span>
              </div>
              <div class="w-full justify-center text-center">
                <el-link
                  v-if="frpcDesktopStore.frpcProcessRunning"
                  class="animate__animated animate__fadeIn"
                  type="primary"
                  @click="$router.replace({ name: 'Logger' })"
                  >查看日志</el-link
                >
              </div>

              <el-button
                class="mt-4"
                type="primary"
                @click="handleButtonClick"
                :disabled="loading"
                >{{ frpcDesktopStore.frpcProcessRunning ? "断 开" : "启 动" }}
              </el-button>
              <!--              <div-->
              <!--                class="w-full h-8 bg-[#563EA4] rounded flex justify-center items-center text-white font-bold cursor-pointer"-->

              <!--              >-->

              <!--              </div>-->
            </div>
          </div>
        </div>
      </div>

      <!--      <el-button-->
      <!--        plain-->
      <!--        type="primary"-->
      <!--        @click="handleStartFrpc"-->
      <!--        :disabled="running"-->
      <!--        >启动-->
      <!--      </el-button>-->
      <!--      <el-button-->
      <!--        plain-->
      <!--        type="danger"-->
      <!--        :disabled="!running"-->
      <!--        @click="handleStopFrpc"-->
      <!--        >停止-->
      <!--      </el-button>-->
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
  //transform-origin: calc(50% - 5px) center;
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
