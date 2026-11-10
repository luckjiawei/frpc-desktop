<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useI18n } from "vue-i18n";

const searchKeyword = defineModel<string>("searchKeyword", { required: true });
const viewMode = defineModel<"card" | "list">("viewMode", { required: true });
const emit = defineEmits<{
  create: [];
  refresh: [];
}>();
const { t } = useI18n();
</script>

<template>
  <Breadcrumb class="proxy-toolbar">
    <template #title-extra>
      <slot name="title-extra" />
    </template>
    <el-button
      class="toolbar-icon-button"
      :aria-label="t('proxy.refresh')"
      :title="t('proxy.refresh')"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
    </el-button>
    <el-button
      type="primary"
      :aria-label="t('proxy.createTitle')"
      :title="t('proxy.createTitle')"
      @click="emit('create')"
    >
      <template #icon>
        <IconifyIconOffline icon="add" />
      </template>
      <span class="toolbar-label">{{ t("proxy.createTitle") }}</span>
    </el-button>
  </Breadcrumb>
  <div class="page-filter-bar proxy-filter-bar">
    <el-input
      v-model="searchKeyword"
      :placeholder="t('proxy.search')"
      :aria-label="t('proxy.search')"
      clearable
      class="proxy-search"
    >
      <template #prefix>
        <IconifyIconOffline icon="search" />
      </template>
    </el-input>
    <el-radio-group v-model="viewMode" class="ml-auto">
      <el-radio-button value="card">
        <span
          class="inline-flex gap-1 items-center"
          :title="t('proxy.viewMode.card')"
        >
          <IconifyIconOffline icon="dashboard" />
          <span class="toolbar-label">{{ t("proxy.viewMode.card") }}</span>
        </span>
      </el-radio-button>
      <el-radio-button value="list">
        <span
          class="inline-flex gap-1 items-center"
          :title="t('proxy.viewMode.list')"
        >
          <IconifyIconOffline icon="table-rows" />
          <span class="toolbar-label">{{ t("proxy.viewMode.list") }}</span>
        </span>
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<style scoped lang="scss">
/* 按标题栏实际宽度（而非窗口宽度）收缩，侧栏展开/折叠时同样生效 */
.proxy-toolbar {
  container-type: inline-size;
  flex-wrap: nowrap;

  :deep(.breadcrumb-left) {
    flex: 0 1 auto;
    min-width: 0;
  }

  :deep(.breadcrumb-right) {
    flex: none;
    flex-wrap: nowrap;
  }
}

.proxy-filter-bar {
  container-type: inline-size;
  flex-wrap: nowrap;
}

.proxy-search.proxy-search {
  flex: 0 1 360px;
  min-width: 140px;
}

@container (max-width: 520px) {
  .toolbar-label {
    display: none;
  }

  /* 只剩图标时去掉图标与文字之间的间距 */
  .el-button :deep(.el-icon + span) {
    margin-left: 0;
  }
}
</style>
