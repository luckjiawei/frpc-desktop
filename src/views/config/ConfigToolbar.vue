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
      plain
      type="primary"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
    </el-button>
    <el-button plain type="primary" @click="emit('openData')">
      <IconifyIconOffline icon="folder-rounded" />
    </el-button>
    <el-button plain type="primary" @click="emit('reset')">
      <IconifyIconOffline icon="deviceReset" />
    </el-button>
    <el-button plain type="primary" @click="emit('import')">
      <IconifyIconOffline icon="file-open-rounded" />
    </el-button>
    <el-button plain type="primary" @click="emit('export')">
      <IconifyIconOffline icon="file-save-rounded" />
    </el-button>
    <el-button type="primary" @click="emit('save')">
      <IconifyIconOffline icon="save-rounded" />
    </el-button>
  </Breadcrumb>
</template>
