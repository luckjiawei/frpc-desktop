<script lang="ts" setup>
import {computed, defineComponent, onMounted, onUnmounted, ref} from "vue";
import {ipcRenderer} from "electron";
import {Icon} from "@iconify/vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import pkg from '../../../package.json';
import {ElMessage, ElMessageBox} from "element-plus";


/**
 * 最后一个版本号
 */
const latestVersionInfo = ref(null);

const isLastVersion = computed(() => {
  if (!latestVersionInfo.value) {
    return true;
  }
  // tagName相对固定
  const tagName = latestVersionInfo.value['tag_name']
  console.log(tagName, latestVersionInfo.value, 'tagName')
  if (!tagName) {
    return true;
  }
  // 最后版本号
  const lastVersion = tagName.replace('v', '').toString();
  const currVersion = pkg.version;
  console.log(lastVersion, currVersion, currVersion >= lastVersion, "isLast")
  // console.log()
  return currVersion >= lastVersion;
  // return false;
})
/**
 * 打开github issues
 */
const handleOpenGitHubIssues = () => {
  ipcRenderer.send("common.openUrl", "https://github.com/luckjiawei/frpc-desktop/issues")
}

/**
 * 打开github主页
 */
const handleOpenGitHub = () => {
  ipcRenderer.send("common.openUrl", "https://github.com/luckjiawei/frpc-desktop")
}

/**
 * 获取最后一个版本
 */
const handleGetLastVersion = () => {

  ipcRenderer.send("github.getFrpcDesktopLastVersions")
}

const handleOpenNewVersion = () => {
  ipcRenderer.send("common.openUrl", latestVersionInfo.value['html_url'])
}

onMounted(() => {
  ipcRenderer.on("github.getFrpcDesktopLastVersionsHook", (event, args) => {
    latestVersionInfo.value = args;
    console.log(latestVersionInfo.value, '1')
    if (!isLastVersion.value) {
      let content = latestVersionInfo.value.body
      content = content.replaceAll('\n', '<br/>')
      ElMessageBox.alert(content, `🎉 发现新版本 ${args.name}`, {
        showCancelButton: true,
        cancelButtonText: "关闭",
        dangerouslyUseHTMLString: true,
        confirmButtonText: "去下载"
      }).then(() => {
        handleOpenNewVersion()
      })
    } else {
      ElMessage({
        message: "当前已是最新版本",
        type: "success"
      })
    }
  });

  handleGetLastVersion();
})

onUnmounted(() => {
  ipcRenderer.removeAllListeners("github.getFrpcDesktopLastVersionsHook");
})

defineComponent({
  name: "About"
});

</script>

<template>
  <div class="main">
    <breadcrumb/>
    <div class="app-container-breadcrumb">
      <div
          class="w-full h-full bg-white p-4 rounded drop-shadow-lg overflow-y-auto flex justify-center items-center flex-col"
      >
        <img src="/logo/pack/1024x1024.png"
             class="w-[95px] h-[95px] mt-[-50px] animate__animated animate__flip" alt="Logo"/>
        <div class="mt-[8px] text-2xl">Frpc Desktop</div>
        <div class="mt-[8px] text-neutral-400 flex items-center">

          <!--          <span class="font-bold">  v{{ pkg.version }}</span>-->
          <el-link
              :class="!isLastVersion? 'line-through': ''"
              class="ml-2 font-bold">v{{ pkg.version }}
          </el-link>
          <el-link v-if="!isLastVersion && latestVersionInfo"
                   @click="handleOpenNewVersion"
                   class="ml-2 text-[#67C23A] font-bold"
                   type="success">v{{ latestVersionInfo.name }}
          </el-link>
          <!--          <span class="ml-2 text-[#67C23A] font-bold"-->
          <!--                @click="handleOpenNewVersion"-->
          <!--                v-if="!isLastVersion && latestVersionInfo">v{{ latestVersionInfo.name }}</span>-->
          <Icon class="ml-1.5 cursor-pointer check-update" icon="material-symbols:refresh-rounded"
                @click="handleGetLastVersion"></Icon>
        </div>
        <div class="mt-[8px] text-sm text-center">
          <p>
            🎉 {{ pkg.description }}
          </p>
          <p>
            开机自启 / 可视化配置 / 免费开源
          </p>
        </div>
        <div class="mt-[12px]">
          <el-button plain type="primary" @click="handleOpenGitHub">
            <Icon class="cursor-pointer mr-2" icon="logos:github-icon"/>
            仓库地址
          </el-button>
          <el-button type="danger" plain @click="handleOpenGitHubIssues">
            <Icon class="cursor-pointer mr-2" icon="material-symbols:question-mark"/>
            反馈问题
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.check-update:hover {
  color: #5F3BB0;
}
</style>
