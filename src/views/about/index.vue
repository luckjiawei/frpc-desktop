<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { Icon } from "@iconify/vue";
import { defineComponent } from "vue";
import { useAbout } from "./index";

defineComponent({
  name: "About"
});

const {
  gitcodeIcon,
  frpcDesktopStore,
  t,
  pkg,
  isLastVersion,
  handleOpenGitHubIssues,
  handleOpenGitHub,
  handleOpenGitCode,
  handleOpenDonate,
  handleOpenDoc,
  handleGetLastVersion,
  handleOpenNewVersion
} = useAbout();
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
            class="ml-2 text-[#67C23A] font-bold"
            type="success"
            @click="handleOpenNewVersion"
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
