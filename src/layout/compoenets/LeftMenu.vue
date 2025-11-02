<script lang="ts" setup>
import { IconifyIconOffline } from "@/components/IconifyIcon";
import Intro from "@/intro";
import router from "@/router";
import { useSystemUsageStore } from "@/store/systemUsage";
import confetti from "canvas-confetti/src/confetti.js";
import "intro.js/introjs.css";
import { computed, defineComponent, onMounted, ref } from "vue";
import { RouteRecordRaw } from "vue-router";
import pkg from "../../../package.json";

defineComponent({
  name: "AppMain"
});

// const frpcDesktopStore = useFrpcDesktopStore();
const systemUsageStore = useSystemUsageStore();
const routes = ref<Array<RouteRecordRaw>>([]);
const guideSteps = ref({
  Home: {
    step: "1",
    intro: "此功能用于控制frpc的连接状态，您可以轻松地断开或重新连接。"
  },
  Proxy: {
    step: "2",
    intro:
      "在这里，您可以方便地配置和管理代理设置。无论是添加、修改还是删除代理，您都可以轻松完成。"
  },
  Download: {
    step: "3",
    intro: "通过此功能，您可以快速下载最新版本的frp。"
  },
  Config: {
    step: "4",
    intro:
      "此功能允许您设置软件的各种配置选项，包括连接方式等。根据您的需求进行个性化设置，以优化使用体验。"
  },
  Logger: {
    step: "5",
    intro:
      "在日志查看功能中，您可以实时查看FRP连接的日志信息。这有助于您监控连接状态，及时排查可能出现的问题。"
  },
  Version: {
    step: "6",
    intro:
      "通过此功能，您可以查看当前安装的Frpc-Desktop版本，并检查是否有可用更新。"
  }
});
const currentRoute = computed(() => {
  return router.currentRoute.value;
});

/**
 * 菜单切换
 * @param mi 菜单索引
 */
const handleMenuChange = (route: any) => {
  if (currentRoute.value.name === route.name) {
    return;
  }
  router.push({
    path: route.path
  });
};

const handleOpenGitHubReleases = () => {
  // ipcRenderer.send("github.openReleases")
  router.push({
    name: "About"
  });
};

const handleCompleteGuide: () => boolean = () => {
  // 礼花
  confetti({
    zIndex: 12002,
    particleCount: 200,
    spread: 70,
    origin: { y: 0.6 }
  });
  localStorage.setItem("guide", new Date().getTime().toString());
  return true; // 确保返回 boolean
};

onMounted(() => {
  routes.value = router.options.routes[0].children?.filter(
    f => !f.meta?.hidden
  ) as Array<RouteRecordRaw>;

  if (!localStorage.getItem("guide")) {
    // 开始
    Intro.onBeforeExit(handleCompleteGuide).start();
  }
});
</script>

<template>
  <div class="drop-shadow-xl left-menu-container">
    <div class="logo-container">
      <!--      <img-->
      <!--        src="/logo/only/128x128.png"-->
      <!--        class="logo animate__animated animate__bounceInLeft"-->
      <!--        alt="Logo"-->
      <!--      />-->
      <!--      <el-badge :value="'v1.1.2'" class="logo" type="primary" :offset="[-10, 42]">-->
      <img src="/logo/only/128x128.png" class="logo" alt="Logo" />
      <!--      </el-badge>-->
    </div>
    <ul class="menu-container">
      <!--      enter-active-class="animate__animated animate__bounceIn"-->
      <!--      leave-active-class="animate__animated animate__fadeOut"-->
      <li
        v-for="r in routes"
        :key="r.name"
        :data-step="guideSteps[r.name]?.step"
        :data-intro="guideSteps[r.name]?.intro"
        :data-disable-interaction="true"
        class="menu animate__animated"
        :class="currentRoute?.name === r.name ? 'menu-selected' : ''"
        @click="handleMenuChange(r)"
      >
        <IconifyIconOffline
          class="animate__animated"
          :icon="r?.meta?.icon as string"
        ></IconifyIconOffline>
      </li>
    </ul>
    <div class="mb-2 menu-footer">
      <!--      <el-tag-->
      <!--        :type="frpcProcessStore.running ? 'primary' : 'warning'"-->
      <!--        effect="light"-->
      <!--        size="small"-->
      <!--        >{{ frpcProcessStore.running ? "运行中" : "已断开" }}-->
      <!--      </el-tag>-->
      <!--      <div-->
      <!--        class="menu animate__animated"-->
      <!--        @click="handleOpenGitHubReleases"-->
      <!--        :data-step="guideSteps.Version?.step"-->
      <!--        :data-intro="guideSteps.Version?.intro"-->
      <!--        data-position="top"-->
      <!--      >-->
      <!--        <IconifyIconOffline-->
      <!--          class="animate__animated"-->
      <!--          icon="attach-money-rounded"-->
      <!--        ></IconifyIconOffline>-->
      <!--      </div>-->
      <div
        class="flex flex-col gap-2 justify-center items-center text-[12px] text-[#6b7280]"
      >
        <div class="flex flex-col justify-center items-center w-full">
          <p class="flex gap-1 items-center font-medium">
            <IconifyIconOffline icon="memory-rounded" />
            CPU
          </p>
          <p class="text-[12px] font-bold">
            {{ systemUsageStore.systemUsageCpu }}%
          </p>
        </div>
        <div class="flex flex-col justify-center items-center w-full">
          <p class="flex gap-1 items-center font-medium">
            <IconifyIconOffline icon="memory-alt-rounded" />
            内存
          </p>
          <p class="text-[12px] font-bold">
            {{ systemUsageStore.systemUsageMemory.used }}MB
          </p>
        </div>
      </div>
      <div
        class="version animate__animated"
        :data-step="guideSteps.Version?.step"
        :data-intro="guideSteps.Version?.intro"
        data-position="top"
        @click="handleOpenGitHubReleases"
      >
        {{ pkg.version }}
      </div>
    </div>
  </div>
</template>
