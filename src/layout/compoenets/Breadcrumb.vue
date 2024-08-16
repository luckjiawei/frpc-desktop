<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, defineComponent } from "vue";
import router from "@/router";


defineComponent({
  name: "Breadcrumb"
});

const currentRoute = computed(() => {
  return router.currentRoute.value;
});
</script>

<template>
  <div class="flex justify-between">
    <div class="breadcrumb animate__animated animate__lightSpeedInLeft">
      <IconifyIconOffline class="inline-block mr-2" :icon="currentRoute.meta['icon'] as string"/>
<!--      <Icon-->
      <!--        class="inline-block mr-2"-->
      <!--        :icon="currentRoute.meta['icon'] as string"-->
      <!--      />-->
      <span>{{ currentRoute.meta["title"] }}</span>
    </div>
    <div class="right">
      <slot></slot>
    </div>
  </div>
</template>
