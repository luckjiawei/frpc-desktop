<script lang="ts" setup>
import { computed, defineComponent } from "vue";
import router from "@/router";

defineComponent({
  name: "AppMain"
});

const currentRoute = computed(() => {
  return router.currentRoute.value;
});
</script>
<template>
  <div class="main-container">
    <router-view v-slot="{ Component }">
      <keep-alive v-if="currentRoute.meta['keepAlive']">
        <component :is="Component" />
      </keep-alive>
      <component :is="Component" v-else />
    </router-view>
  </div>
</template>
