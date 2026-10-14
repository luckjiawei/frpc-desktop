<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import router from "@/router";
import { useI18n } from "vue-i18n";

const emit = defineEmits<{
  export: [];
  import: [];
  refresh: [];
  save: [];
}>();
const { t } = useI18n();
</script>

<template>
  <Breadcrumb>
    <template #title-extra>
      <slot name="title-extra" />
      <el-button
        text
        size="small"
        :title="t('tunnel.back')"
        @click="router.push({ name: 'Tunnel' })"
      >
        <template #icon>
          <IconifyIconOffline icon="arrow-back-rounded" />
        </template>
        {{ t("tunnel.back") }}
      </el-button>
    </template>
    <el-button
      :aria-label="t('config.button.manualRefresh')"
      :title="t('config.button.manualRefresh')"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
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
