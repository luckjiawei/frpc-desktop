<script lang="ts">
import { ElConfigProvider } from "element-plus";
import en from "element-plus/dist/locale/en.mjs";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import zhTw from "element-plus/dist/locale/zh-tw.mjs";
import { defineComponent } from "vue";
import { useFrpcDesktopStore } from "./store/frpcDesktop";

export default defineComponent({
  name: "App",
  components: {
    [ElConfigProvider.name]: ElConfigProvider
  },
  computed: {
    currentLocale() {
      const language = useFrpcDesktopStore().frpcDesktopLanguage;
      if (language === "zh-CN") return zhCn;
      if (language === "zh-TW") return zhTw;
      return en;
    }
  }
});
</script>

<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
  </el-config-provider>
</template>
