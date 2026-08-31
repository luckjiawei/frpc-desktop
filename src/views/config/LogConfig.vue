<script lang="ts" setup>
import { useI18n } from "vue-i18n";

const formData = defineModel<OpenSourceFrpcDesktopServer>({ required: true });
const { t } = useI18n();
</script>

<template>
  <el-col :span="24">
    <div class="h2">{{ t("config.title.logConfiguration") }}</div>
  </el-col>
  <el-col :span="12">
    <el-form-item
      class="!w-full"
      :label="t('config.form.logLevel.label')"
      prop="log.level"
    >
      <el-select v-model="formData.log.level">
        <el-option label="info" value="info" />
        <el-option label="debug" value="debug" />
        <el-option label="warn" value="warn" />
        <el-option label="error" value="error" />
      </el-select>
    </el-form-item>
  </el-col>
  <el-col :span="12">
    <el-form-item :label="t('config.form.logMaxDays.label')" prop="log.maxDays">
      <el-input-number
        v-model="formData.log.maxDays"
        class="!w-full"
        controls-position="right"
      />
    </el-form-item>
  </el-col>
</template>
