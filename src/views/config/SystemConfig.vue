<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useI18n } from "vue-i18n";

const formData = defineModel<OpenSourceFrpcDesktopServer>({ required: true });
const emit = defineEmits<{
  languageChange: [language: string];
}>();
const { t } = useI18n();
</script>

<template>
  <el-col :span="24">
    <div class="h2">{{ t("config.title.systemConfiguration") }}</div>
  </el-col>
  <el-col :span="8">
    <el-form-item
      :label="t('config.form.systemLaunchAtStartup.label')"
      prop="system.launchAtStartup"
    >
      <template #label>
        <div class="flex items-center mr-1 h-full">
          <el-popover placement="top" width="300" trigger="hover">
            <template #default>
              <div v-html="t('config.form.systemLaunchAtStartup.tips')"></div>
            </template>
            <template #reference>
              <IconifyIconOffline
                class="text-base"
                color="#5A3DAA"
                icon="info"
              />
            </template>
          </el-popover>
        </div>
        {{ t("config.form.systemLaunchAtStartup.label") }}
      </template>
      <el-switch
        v-model="formData.system.launchAtStartup"
        :active-text="t('common.yes')"
        :inactive-text="t('common.no')"
        inline-prompt
      />
    </el-form-item>
  </el-col>
  <el-col :span="8">
    <el-form-item
      :label="t('config.form.systemSilentStartup.label')"
      prop="system.silentStartup"
    >
      <template #label>
        <div class="flex items-center mr-1 h-full">
          <el-popover placement="top" width="300" trigger="hover">
            <template #default>
              <div v-html="t('config.form.systemSilentStartup.tips')"></div>
            </template>
            <template #reference>
              <IconifyIconOffline
                class="text-base"
                color="#5A3DAA"
                icon="info"
              />
            </template>
          </el-popover>
        </div>
        {{ t("config.form.systemSilentStartup.label") }}
      </template>
      <el-switch
        v-model="formData.system.silentStartup"
        :active-text="t('common.yes')"
        :inactive-text="t('common.no')"
        inline-prompt
      />
    </el-form-item>
  </el-col>
  <el-col :span="8">
    <el-form-item
      :label="t('config.form.systemAutoConnectOnStartup.label')"
      prop="system.autoConnectOnStartup"
    >
      <template #label>
        <div class="flex items-center mr-1 h-full">
          <el-popover placement="top" width="300" trigger="hover">
            <template #default>
              <div
                v-html="t('config.form.systemAutoConnectOnStartup.tips')"
              ></div>
            </template>
            <template #reference>
              <IconifyIconOffline
                class="text-base"
                color="#5A3DAA"
                icon="info"
              />
            </template>
          </el-popover>
        </div>
        {{ t("config.form.systemAutoConnectOnStartup.label") }}
      </template>
      <el-switch
        v-model="formData.system.autoConnectOnStartup"
        :active-text="t('common.yes')"
        :inactive-text="t('common.no')"
        inline-prompt
      />
    </el-form-item>
  </el-col>
  <el-col :span="24">
    <el-form-item
      :label="t('config.form.systemLanguage.label')"
      prop="system.language"
    >
      <el-select
        v-model="formData.system.language"
        @change="emit('languageChange', $event)"
      >
        <el-option label="中文" value="zh-CN" />
        <el-option label="English" value="en-US" />
      </el-select>
    </el-form-item>
  </el-col>
</template>
