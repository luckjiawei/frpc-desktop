<script lang="ts" setup>
import { defineComponent } from "vue";

defineComponent({
  name: "AppMain"
});
</script>
<template>
  <div class="main-container">
    <router-view v-slot="{ Component }">
      <keep-alive :include="['ProxyPage', 'ConfigPage']">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>
