<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useI18n } from "vue-i18n";

defineProps<{
  loading: boolean;
  ports: LocalPort[];
}>();
const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  select: [port: number];
}>();
const { t } = useI18n();
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('proxy.dialog.listPorts.title')"
    destroy-on-close
    width="600"
    top="5%"
  >
    <el-table
      v-if="visible"
      v-loading="loading"
      :data="ports"
      stripe
      border
      height="400"
    >
      <el-table-column
        :label="t('proxy.dialog.listPorts.table.columns.protocol')"
        :width="100"
        prop="protocol"
      />
      <el-table-column
        :label="t('proxy.dialog.listPorts.table.columns.ip')"
        prop="ip"
      />
      <el-table-column
        :label="t('proxy.dialog.listPorts.table.columns.port')"
        :width="80"
        prop="port"
      />
      <el-table-column :label="t('common.operation')" :width="100">
        <template #default="scope">
          <el-button type="text" @click="emit('select', scope.row.port)">
            <IconifyIconOffline
              class="mr-2 cursor-pointer"
              icon="gesture-select"
            />
            {{ t("common.select") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>
