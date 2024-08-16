<script lang="ts" setup>
import {defineComponent, onMounted, onUnmounted, ref} from "vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import {ipcRenderer} from "electron";
import {ElMessageBox} from "element-plus";
import router from "@/router";
import {useDebounceFn} from "@vueuse/core";

defineComponent({
  name: "Home"
});

const running = ref(false);

const handleStartFrpc = () => {
  ipcRenderer.send("frpc.start");
};

const handleStopFrpc = () => {
  ipcRenderer.send("frpc.stop");
};

const handleButtonClick = useDebounceFn(() => {
  if (running.value) {
    handleStopFrpc();
  } else {
    handleStartFrpc();
  }
}, 300);

onMounted(() => {
  setInterval(() => {
    ipcRenderer.invoke("frpc.running").then(data => {
      running.value = data;
      console.log('进程状态', data)
    });
  }, 300);

  ipcRenderer.on("Home.frpc.start.error.hook", (event, args) => {
    if (args) {
      ElMessageBox.alert(args, "启动失败", {
        showCancelButton: true,
        cancelButtonText: "取消",
        confirmButtonText: "去设置"
      }).then(() => {
        router.replace({
          name: "Config"
        });
      });
    }
  });
});

onUnmounted(() => {
  ipcRenderer.removeAllListeners("Home.frpc.start.error.hook");
});
</script>

<template>
  <div class="main">
    <breadcrumb/>
    <div class="app-container-breadcrumb">
      <div
          class="w-full h-full bg-white p-4 rounded drop-shadow-lg overflow-y-auto flex justify-center items-center"
      >
        <div class="flex">
          <div
              class="w-40 h-40 border-[#5A3DAA] text-[#5A3DAA] border-4 rounded-full flex justify-center items-center text-[100px] relative"
          >
            <transition name="fade">
              <div
                  v-show="running"
                  class="z-0 rounded-full opacity-20 left-circle bg-[#5A3DAA] w-full h-full animation-rotate-1"
              />
            </transition>
            <transition name="fade">
              <div
                  v-show="running"
                  class="z-0 rounded-full opacity-20 right-circle top-[10px] bg-[#5A3DAA] w-full h-full animation-rotate-2"
              />
            </transition>
            <transition name="fade">
              <div
                  v-show="running"
                  class="z-0 rounded-full opacity-20 top-circle bg-[#5A3DAA] w-full h-full animation-rotate-3"
              />
            </transition>
            <div
                class="bg-white z-10 w-full h-full bg-white absolute rounded-full flex justify-center items-center"
            >
              <IconifyIconOffline icon="rocket-launch-rounded"/>
            </div>
          </div>
          <div class="flex justify-center items-center">
            <div class="pl-8 h-28 w-52 flex flex-col justify-between">
              <transition name="fade">
                <div class="font-bold text-2xl text-center">
                  <IconifyIconOffline
                      v-if="running"
                      class="text-[#7EC050]
                       inline-block relative top-1"
                      icon="check-circle-rounded"/>
                  <IconifyIconOffline
                      v-else
                      class="text-[#E47470] inline-block relative top-1"
                      icon="error"/>
                  Frpc {{ running ? "已启动" : "已断开" }}
                </div>
              </transition>
              <!--              <el-button-->
              <!--                  class="block"-->
              <!--                  type="text"-->
              <!--                  v-if="running"-->
              <!--                  @click="$router.replace({ name: 'Logger' })"-->
              <!--              >查看日志-->
              <!--              </el-button>-->
              <div class="w-full justify-center text-center">
                <el-link v-if="running" type="primary" @click="$router.replace({ name: 'Logger' })">查看日志</el-link>
              </div>
              <div
                  class="w-full h-8 bg-[#563EA4] rounded flex justify-center items-center text-white font-bold cursor-pointer"
                  @click="handleButtonClick"
              >
                {{ running ? "断 开" : "启 动" }}
              </div>
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
