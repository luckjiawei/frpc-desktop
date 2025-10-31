<script lang="ts" setup>
import gitcodeIcon from "@/assets/gitcode.svg";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { send } from "@/utils/ipcUtils";
import { Icon } from "@iconify/vue";
import { computed, defineComponent, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";
import pkg from "../../../package.json";

const frpcDesktopStore = useFrpcDesktopStore();
const { t } = useI18n();

/**
 * 最后一个版本号
 */
const isLastVersion = computed(() => {
  if (!frpcDesktopStore.frpcDesktopLastRelease) {
    return true;
  }
  // tagName相对固定
  const tagName = frpcDesktopStore.frpcDesktopLastRelease["tag_name"];
  if (!tagName) {
    return true;
  }
  // 最后版本号
  const lastVersion = tagName.replace("v", "").toString();
  const currVersion = pkg.version;
  return currVersion >= lastVersion;
});

/**
 * 打开github issues
 */
const handleOpenGitHubIssues = () => {
  send(ipcRouters.SYSTEM.openUrl, {
    url: "https://github.com/luckjiawei/frpc-desktop/issues"
  });
};

/**
 * 打开github主页
 */
const handleOpenGitHub = () => {
  send(ipcRouters.SYSTEM.openUrl, {
    url: "https://github.com/luckjiawei/frpc-desktop"
  });
};

const handleOpenGitCode = () => {
  send(ipcRouters.SYSTEM.openUrl, {
    url: "https://gitcode.com/luckjiawei/frpc-desktop"
  });
};

/**
 * 打开捐赠界面
 */
const handleOpenDonate = () => {
  send(ipcRouters.SYSTEM.openUrl, {
    url: "https://jwinks.com/donate"
  });
};

/**
 * 打开文档
 */
const handleOpenDoc = () => {
  send(ipcRouters.SYSTEM.openUrl, {
    url: "https://jwinks.com/p/frp"
  });
};

/**
 * 获取最后一个版本
 */
const handleGetLastVersion = () => {
  frpcDesktopStore.checkNewVersion(true);
};

const handleOpenNewVersion = () => {
  send(ipcRouters.SYSTEM.openUrl, {
    url: frpcDesktopStore.frpcDesktopLastRelease["html_url"]
  });
};

onMounted(() => {
  // handleGetLastVersion();
});

onUnmounted(() => {
  // removeRouterListeners(ipcRouters.SYSTEM.getFrpcDesktopGithubLastRelease);
});

defineComponent({
  name: "About"
});
</script>

<template>
  <div class="main">
    <breadcrumb />
    <div class="app-container-breadcrumb">
      <div
        class="flex overflow-y-auto flex-col justify-center items-center p-4 w-full h-full bg-white rounded drop-shadow-lg"
      >
        <img
          src="/logo/pack/1024x1024.png"
          class="w-[95px] h-[95px] mt-[-50px] animate__animated animate__flip"
          alt="Logo"
        />
        <div class="mt-[8px] text-2xl">Frpc Desktop</div>
        <div class="mt-[8px] text-neutral-400 flex items-center">
          <el-link
            :class="!isLastVersion ? 'line-through' : ''"
            class="ml-2 font-bold"
            >v{{ pkg.version }}
          </el-link>
          <el-link
            v-if="!isLastVersion && frpcDesktopStore.frpcDesktopLastRelease"
            @click="handleOpenNewVersion"
            class="ml-2 text-[#67C23A] font-bold"
            type="success"
            >v{{ frpcDesktopStore.frpcDesktopLastRelease.name }}
          </el-link>
          <IconifyIconOffline
            class="ml-1.5 cursor-pointer check-update"
            icon="refresh-rounded"
            @click="handleGetLastVersion"
          />
        </div>
        <div class="mt-[8px] text-sm text-center">
          <p>🎉 {{ t("about.description") }}</p>
          <p>
            {{ t("about.features.autoStart") }} /
            {{ t("about.features.visualConfig") }} /
            {{ t("about.features.freeAndOpen") }}
          </p>
        </div>
        <div class="mt-[12px]">
          <el-button plain type="primary" @click="handleOpenGitHub">
            <Icon class="mr-2 cursor-pointer" icon="logos:github-icon" />
            {{ t("about.button.github") }}
          </el-button>
          <el-button plain type="primary" @click="handleOpenGitCode">
            <img :src="gitcodeIcon" class="mr-2 w-4 h-4" alt="GitCode" />
            GitCode
          </el-button>
        </div>
        <div class="mt-[12px]">
          <el-button plain type="success" @click="handleOpenDoc">
            <IconifyIconOffline
              class="mr-2 cursor-pointer"
              icon="description"
            />
            {{ t("about.button.doc") }}
          </el-button>
          <el-button plain type="success" @click="handleOpenDonate">
            <IconifyIconOffline
              class="mr-2 cursor-pointer"
              icon="volunteer-activism-sharp"
            />
            {{ t("about.button.donate") }}
          </el-button>
          <el-button type="danger" plain @click="handleOpenGitHubIssues">
            <IconifyIconOffline
              class="mr-2 cursor-pointer"
              icon="question-mark"
            />
            {{ t("about.button.issues") }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.check-update:hover {
  color: #5f3bb0;
}
</style>
