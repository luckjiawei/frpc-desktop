<script lang="ts" setup>
import { IconifyIconOffline } from "@/components/IconifyIcon";
import { ipcRouters } from "@/core/IpcRouter";
import Intro from "@/intro";
import router from "@/router";
import { useSystemUsageStore } from "@/store/systemUsage";
import { ThemeMode, useThemeStore } from "@/store/theme";
import { on, send } from "@/utils/ipcUtils";
import confetti from "canvas-confetti/src/confetti.js";
import "intro.js/introjs.css";
import { computed, defineComponent, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RouteRecordRaw } from "vue-router";
import pkg from "../../../package.json";

defineComponent({
  name: "AppMain"
});

// const frpcDesktopStore = useFrpcDesktopStore();
const systemUsageStore = useSystemUsageStore();
const themeStore = useThemeStore();
const { t } = useI18n();

// 折叠状态只影响本机界面，保存在 localStorage 即可
const COLLAPSE_KEY = "frpc-sidebar-collapsed";
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === "true");
const toggleCollapsed = () => {
  collapsed.value = !collapsed.value;
  localStorage.setItem(COLLAPSE_KEY, String(collapsed.value));
};

const themeOptions: Array<{ mode: ThemeMode; icon: string; label: string }> = [
  { mode: "light", icon: "light-mode-outline", label: "layout.theme.light" },
  { mode: "dark", icon: "dark-mode-outline", label: "layout.theme.dark" },
  { mode: "auto", icon: "brightness-auto-outline", label: "layout.theme.auto" }
];
const currentThemeOption = computed(
  () => themeOptions.find(o => o.mode === themeStore.mode) ?? themeOptions[2]
);
const routes = ref<Array<RouteRecordRaw>>([]);
const guideSteps = ref({
  Home: {
    step: "1",
    intro: "仪表盘汇总了所有实例的运行状态、代理数量和连接异常。"
  },
  Tunnel: {
    step: "2",
    intro:
      "在这里管理 frpc 实例：新建、启动或断开连接，进入实例的配置，或查看实例日志。"
  },
  Proxy: {
    step: "3",
    intro:
      "在这里，您可以方便地配置和管理代理设置。无论是添加、修改还是删除代理，您都可以轻松完成。"
  },
  Download: {
    step: "4",
    intro: "通过此功能，您可以快速下载最新版本的frp。"
  },
  System: {
    step: "5",
    intro: "在这里设置开机自启、静默启动、启动时自动连接和语言等全局选项。"
  },
  Logger: {
    step: "6",
    intro: "在这里查看应用日志；各实例的 frpc 日志可在实例页面中查看。"
  },
  Version: {
    step: "7",
    intro:
      "通过此功能，您可以查看当前安装的Frpc-Desktop版本，并检查是否有可用更新。"
  }
});
const currentRoute = computed(() => {
  return router.currentRoute.value;
});
// 隐藏的子页面（如实例配置）通过 meta.activeMenu 高亮所属菜单
const activeMenuName = computed(
  () =>
    (currentRoute.value?.meta?.activeMenu as string | undefined) ??
    currentRoute.value?.name
);

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
  send(ipcRouters.SYSTEM.completeGuide);
  return true; // 确保返回 boolean
};

let offGuideStatus: (() => void) | undefined;

onMounted(() => {
  routes.value = router.options.routes[0].children?.filter(
    f => !f.meta?.hidden
  ) as Array<RouteRecordRaw>;

  offGuideStatus = on(
    ipcRouters.SYSTEM.getGuideStatus,
    (completed: boolean) => {
      if (completed) {
        return;
      }
      // 兼容旧版本保存在 localStorage 中的引导状态
      if (localStorage.getItem("guide")) {
        send(ipcRouters.SYSTEM.completeGuide);
        localStorage.removeItem("guide");
        return;
      }
      // 开始
      Intro.onBeforeExit(handleCompleteGuide).start();
    }
  );
  send(ipcRouters.SYSTEM.getGuideStatus);
});

onUnmounted(() => {
  offGuideStatus?.();
});
</script>

<template>
  <nav
    class="left-menu-container"
    :class="{ 'is-collapsed': collapsed }"
    :aria-label="t('layout.navigation')"
  >
    <div class="menu-brand">
      <img src="/logo/only/128x128.png" alt="" />
      <span v-show="!collapsed">Frpc Desktop</span>
    </div>
    <div class="menu-list">
      <el-tooltip
        v-for="r in routes"
        :key="r.name"
        :content="t(r.meta?.title as string)"
        :disabled="!collapsed"
        placement="right"
      >
        <button
          type="button"
          class="menu-item"
          :class="{ 'is-active': activeMenuName === r.name }"
          :aria-current="activeMenuName === r.name ? 'page' : undefined"
          :aria-label="t(r.meta?.title as string)"
          :data-step="guideSteps[r.name]?.step"
          :data-intro="guideSteps[r.name]?.intro"
          :data-disable-interaction="true"
          @click="handleMenuChange(r)"
        >
          <IconifyIconOffline :icon="r?.meta?.icon as string" />
          <span v-show="!collapsed">{{ t(r.meta?.title as string) }}</span>
        </button>
      </el-tooltip>
    </div>
    <div class="menu-footer">
      <div class="menu-usage">
        <div class="usage-row">
          <IconifyIconOffline icon="memory-rounded" />
          <span>CPU</span>
          <b>{{ systemUsageStore.systemUsageCpu }}%</b>
        </div>
        <div class="usage-row">
          <IconifyIconOffline icon="memory-alt-rounded" />
          <span v-show="!collapsed">{{ t("layout.memory") }}</span>
          <b>{{ systemUsageStore.formattedMemory }}</b>
        </div>
      </div>
      <div class="menu-actions">
        <el-dropdown
          trigger="click"
          :placement="collapsed ? 'right-end' : 'top-start'"
          @command="themeStore.setMode"
        >
          <el-button
            text
            circle
            :aria-label="t('layout.theme.title')"
            :title="t('layout.theme.title')"
          >
            <IconifyIconOffline :icon="currentThemeOption.icon" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="option in themeOptions"
                :key="option.mode"
                :command="option.mode"
                :class="{ 'is-theme-active': themeStore.mode === option.mode }"
              >
                <IconifyIconOffline class="mr-2" :icon="option.icon" />
                {{ t(option.label) }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          text
          circle
          :aria-label="
            collapsed ? t('layout.expandMenu') : t('layout.collapseMenu')
          "
          :title="collapsed ? t('layout.expandMenu') : t('layout.collapseMenu')"
          @click="toggleCollapsed"
        >
          <IconifyIconOffline
            :icon="
              collapsed ? 'left-panel-open-outline' : 'left-panel-close-outline'
            "
          />
        </el-button>
        <button
          type="button"
          class="menu-version"
          :data-step="guideSteps.Version?.step"
          :data-intro="guideSteps.Version?.intro"
          data-position="top"
          :title="t('layout.about')"
          @click="handleOpenGitHubReleases"
        >
          v{{ pkg.version }}
        </button>
      </div>
    </div>
  </nav>
</template>
