<script lang="ts" setup>
import {defineComponent} from "vue";
import {ipcRenderer, clipboard} from "electron";
import {Icon} from "@iconify/vue";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import {ElMessage} from "element-plus";
import pkg from '../../../package.json';

const handleOpenGitHub = () => {
  ipcRenderer.send("github.open")
}

const handleCopyInfo = () => {
  ElMessage({
    message: '复制成功',
    type: 'success',
  })
  clipboard.writeText(`
      Frpc Desktop
     v${pkg.version}
更简单的内网穿透工具！免费开源 / 桌面客户端 / 开机启动
  `)
}

defineComponent({
  name: "About"
});

</script>

<template>
  <div class="main">
    <breadcrumb/>
    <div
      class="w-full h-full bg-white p-4 rounded drop-shadow-lg overflow-y-auto flex justify-center items-center flex-col"
    >
      <img src="/logo/only/1024x1024.png" class="w-[95px] h-[95px]" alt="Logo"/>
      <div class="mt-[8px] text-2xl">Frpc Desktop</div>
      <div class="mt-[8px] text-neutral-400 flex items-center">
        v{{pkg.version}}
        <Icon class="ml-1.5 cursor-pointer" icon="material-symbols:refresh-rounded"></Icon>
      </div>
      <div class="mt-[8px] text-sm">更简单的内网穿透工具！免费开源 / 桌面客户端 / 开机启动</div>
      <div class="mt-[12px]">
        <el-button type="primary" @click="handleCopyInfo">复制信息</el-button>
        <el-button type="danger" plain @click="handleOpenGitHub">反馈问题</el-button>
      </div>
    </div>
  </div>
</template>