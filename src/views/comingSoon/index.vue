<script lang="ts" setup>
import { defineComponent } from "vue";

defineComponent({
  name: "ComingSoon"
});
</script>

<template>
  <div
    class="w-full h-full bg-white rounded p-2 overflow-hidden drop-shadow-xl flex justify-center items-center"
  >
    <el-empty description="敬请期待" />
  </div>
</template>
