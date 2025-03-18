<script setup lang="ts">
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
  <div class="flex items-center justify-between breadcrumb">
    <!--    animate__animated animate__lightSpeedInLeft-->
    <div class="flex items-center justify-center breadcrumb-left">
      <IconifyIconOffline
        class="inline-block mr-2"
        :icon="currentRoute.meta['icon'] as string"
      />
      <span>{{ $t(currentRoute.meta["title"] as string) }}</span>
    </div>
    <div class="breadcrumb-right">
      <slot></slot>
    </div>
  </div>
</template>
