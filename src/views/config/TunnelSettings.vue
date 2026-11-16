<script lang="ts" setup>
import { useI18n } from "vue-i18n";

defineProps<{
  tunnel: Pick<TunnelSummary, "id">;
}>();
const name = defineModel<string>("name", { required: true });
const autoStart = defineModel<boolean>("autoStart", { required: true });
const { t } = useI18n();
</script>

<template>
  <el-row :gutter="10">
    <el-col :span="24">
      <el-form-item :label="t('tunnel.prompt.nameLabel')" prop="instanceName">
        <el-input
          v-model="name"
          maxlength="64"
          show-word-limit
          :placeholder="t('tunnel.prompt.namePlaceholder')"
        />
      </el-form-item>
    </el-col>
    <el-col :span="24">
      <el-form-item :label="t('tunnel.autoStart')" prop="autoStart">
        <div class="flex flex-wrap gap-2 items-center">
          <el-switch v-model="autoStart" :aria-label="t('tunnel.autoStart')" />
          <span class="text-xs text-text_color-secondary">
            {{ t("tunnel.autoStartHint") }}
          </span>
        </div>
      </el-form-item>
    </el-col>
  </el-row>
</template>
