<script setup lang="ts">
import { computed, defineComponent } from "vue";
import { useRoute } from "vue-router";

defineComponent({
  name: "Breadcrumb"
});

const route = useRoute();
// 路由切换的瞬间 meta 可能为空，避免 $t(undefined) 抛错中断渲染
const title = computed(() => route.meta?.title as string | undefined);
const icon = computed(() => route.meta?.icon as string | undefined);
</script>

<template>
  <div class="flex justify-between items-center breadcrumb">
    <div class="flex items-center breadcrumb-left">
      <div class="breadcrumb-icon">
        <IconifyIconOffline v-if="icon" :icon="icon" />
      </div>
      <span>{{ title ? $t(title) : "" }}</span>
      <slot name="title-extra"></slot>
    </div>
    <div class="flex items-center breadcrumb-right">
      <slot></slot>
    </div>
  </div>
</template>
