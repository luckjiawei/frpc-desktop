<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useI18n } from "vue-i18n";

const emit = defineEmits<{
  export: [];
  import: [];
  refresh: [];
}>();
const { t } = useI18n();
</script>

<template>
  <div class="flex flex-none gap-1 items-center">
    <el-button
      text
      :aria-label="t('config.button.manualRefresh')"
      :title="t('config.button.manualRefresh')"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
    </el-button>
    <el-button
      text
      :aria-label="t('config.button.importToml')"
      :title="t('config.button.importToml')"
      @click="emit('import')"
    >
      <IconifyIconOffline icon="file-open-rounded" />
    </el-button>
    <el-button
      text
      :aria-label="t('config.button.exportConfig')"
      :title="t('config.button.exportConfig')"
      @click="emit('export')"
    >
      <IconifyIconOffline icon="file-save-rounded" />
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.el-button + .el-button {
  margin-left: 0;
}
</style>
