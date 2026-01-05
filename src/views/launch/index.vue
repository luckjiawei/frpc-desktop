<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { defineComponent } from "vue";
import { useLaunch } from ".";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
defineComponent({
  name: "Launch"
});
const frpcDesktopStore = useFrpcDesktopStore();

const { uptime, loading, handleButtonClick } = useLaunch();
</script>

<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <div
        class="flex overflow-y-auto justify-center items-center p-4 w-full h-full bg-white rounded drop-shadow-lg"
      >
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
            <div class="flex flex-col gap-4 justify-between pl-10 w-72">
              <transition name="fade">
                <div
                  class="flex gap-1 justify-center text-2xl font-bold text-center"
                >
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
                  <span>
                    {{
                      $t("home.status.frpcStatus", {
                        status: frpcDesktopStore.frpcProcessRunning
                          ? $t("home.status.running")
                          : $t("home.status.disconnected")
                      })
                    }}
                  </span>
                </div>
              </transition>
              <div
                v-if="frpcDesktopStore.frpcProcessRunning"
                class="justify-center w-full text-sm text-center animate__animated animate__fadeIn"
              >
                <span class="el-text--success">{{
                  $t("home.status.runningTime")
                }}</span>
                <span class="ml-1 font-bold text-primary">{{ uptime }}</span>

                <div class="justify-center w-full text-center">
                  <el-link
                    v-if="frpcDesktopStore.frpcProcessRunning"
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
