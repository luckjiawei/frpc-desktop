<script setup lang="ts">
import router from "@/router";
import { computed, defineComponent } from "vue";

defineComponent({
  name: "Breadcrumb"
});

const currentRoute = computed(() => {
  return router.currentRoute.value;
});
</script>

<template>
  <div class="flex justify-between items-center breadcrumb">
    <!--    animate__animated animate__lightSpeedInLeft-->
    <div class="flex justify-center items-center breadcrumb-left">
      <IconifyIconOffline
        class="inline-block mr-2"
        :icon="currentRoute.meta['icon'] as string"
      />
      <span>{{ $t(currentRoute.meta["title"] as string) }}</span>
    </div>
    <div class="flex items-center breadcrumb-right">
      <slot></slot>
    </div>
  </div>
</template>
