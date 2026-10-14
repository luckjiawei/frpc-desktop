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
  <Breadcrumb>
    <template #title-extra>
      <slot name="title-extra" />
    </template>
    <el-input
      v-model="searchKeyword"
      :placeholder="t('proxy.search')"
      clearable
      class="!w-[240px]"
      size="default"
    >
      <template #prefix>
        <IconifyIconOffline icon="search" />
      </template>
    </el-input>
    <el-radio-group v-model="viewMode">
      <el-radio-button value="card">
        <span class="inline-flex gap-1 items-center">
          <IconifyIconOffline icon="dashboard" />
          {{ t("proxy.viewMode.card") }}
        </span>
      </el-radio-button>
      <el-radio-button value="list">
        <span class="inline-flex gap-1 items-center">
          <IconifyIconOffline icon="table-rows" />
          {{ t("proxy.viewMode.list") }}
        </span>
      </el-radio-button>
    </el-radio-group>
    <el-button
      :aria-label="t('proxy.refresh')"
      :title="t('proxy.refresh')"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
    </el-button>
    <el-button type="primary" @click="emit('create')">
      <template #icon>
        <IconifyIconOffline icon="add" />
      </template>
      {{ t("proxy.createTitle") }}
    </el-button>
  </Breadcrumb>
</template>
