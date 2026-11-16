<script lang="ts" setup>
import { useI18n } from "vue-i18n";

const formData = defineModel<OpenSourceFrpcDesktopServer>({ required: true });
const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false
});
const { t } = useI18n();

/** 与应用日志级别保持一致的选项顺序与文案 */
const logLevels = ["error", "warn", "info", "debug"] as const;
</script>

<template>
  <el-col :span="24">
    <div v-if="!props.embedded" class="h2">
      {{ t("config.title.logConfiguration") }}
    </div>
  </el-col>
  <el-col :span="12">
    <el-form-item
      class="!w-full"
      :label="t('config.form.logLevel.label')"
      prop="log.level"
    >
      <el-select v-model="formData.log.level">
        <el-option
          v-for="level in logLevels"
          :key="level"
          :label="t(`logger.level.${level}`)"
          :value="level"
        />
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
