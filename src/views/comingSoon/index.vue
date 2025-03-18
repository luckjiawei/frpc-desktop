<script lang="ts" setup>
import { defineComponent } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineComponent({
  name: "ComingSoon"
});
</script>

<template>
  <div
    class="flex items-center justify-center w-full h-full p-2 overflow-hidden bg-white rounded drop-shadow-xl"
  >
    <el-empty :description="t('comingSoon.description')" />
  </div>
</template>
