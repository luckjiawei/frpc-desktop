<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useI18n } from "vue-i18n";

const emit = defineEmits<{
  export: [];
  import: [];
  openData: [];
  refresh: [];
  reset: [];
  save: [];
}>();
const { t } = useI18n();
</script>

<template>
  <Breadcrumb>
    <el-button
      :aria-label="t('config.button.manualRefresh')"
      :title="t('config.button.manualRefresh')"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
    </el-button>
    <el-button
      :aria-label="t('config.button.openData')"
      :title="t('config.button.openData')"
      @click="emit('openData')"
    >
      <IconifyIconOffline icon="folder-rounded" />
    </el-button>
    <el-button
      :aria-label="t('config.button.resetAll')"
      :title="t('config.button.resetAll')"
      @click="emit('reset')"
    >
      <IconifyIconOffline icon="deviceReset" />
    </el-button>
    <el-button
      :aria-label="t('config.button.importToml')"
      :title="t('config.button.importToml')"
      @click="emit('import')"
    >
      <IconifyIconOffline icon="file-open-rounded" />
    </el-button>
    <el-button
      :aria-label="t('config.button.exportConfig')"
      :title="t('config.button.exportConfig')"
      @click="emit('export')"
    >
      <IconifyIconOffline icon="file-save-rounded" />
    </el-button>
    <el-button
      type="primary"
      :title="t('config.button.saveWithShortcut')"
      :aria-label="t('config.button.saveWithShortcut')"
      @click="emit('save')"
    >
      <IconifyIconOffline icon="save-rounded" />
    </el-button>
  </Breadcrumb>
</template>
