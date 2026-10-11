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
    <el-input
      v-model="searchKeyword"
      :placeholder="t('proxy.search')"
      clearable
      class="mr-2 !w-[300px]"
      size="default"
    >
      <template #prefix>
        <IconifyIconOffline icon="search" />
      </template>
    </el-input>
    <el-radio-group v-model="viewMode" class="mr-2">
      <el-radio-button value="card">
        <IconifyIconOffline class="mr-1" icon="dashboard" />
        {{ t("proxy.viewMode.card") }}
      </el-radio-button>
      <el-radio-button value="list">
        <IconifyIconOffline class="mr-1" icon="table-rows" />
        {{ t("proxy.viewMode.list") }}
      </el-radio-button>
    </el-radio-group>
    <el-button
      :aria-label="t('proxy.refresh')"
      :title="t('proxy.refresh')"
      plain
      type="primary"
      @click="emit('refresh')"
    >
      <IconifyIconOffline icon="refresh-rounded" />
    </el-button>
    <el-button type="primary" @click="emit('create')">
      <IconifyIconOffline icon="add" />
    </el-button>
  </Breadcrumb>
</template>
