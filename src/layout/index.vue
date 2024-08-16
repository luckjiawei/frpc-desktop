<script lang="ts" setup>
import { defineComponent } from "vue";
import AppMain from "./compoenets/AppMain.vue";
import LeftMenu from "./compoenets/LeftMenu.vue";
import "@/components/IconifyIcon/src/offlineIcon";

defineComponent({
  name: "Layout"
});
</script>
<template>
  <div class="w-full h-full flex">
    <left-menu />
    <app-main />
  </div>
</template>
