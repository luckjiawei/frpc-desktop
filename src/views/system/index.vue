<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { on, send } from "@/utils/ipcUtils";
import { useDebounceFn } from "@vueuse/core";
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "@/core/IpcRouter";

defineOptions({
  name: "SystemPage"
});

const { t } = useI18n();
const frpcDesktopStore = useFrpcDesktopStore();
const loading = ref(true);
const saving = ref(false);
const formData = ref<FrpcSystemConfiguration>({
  launchAtStartup: false,
  silentStartup: false,
  autoConnectOnStartup: false,
  language: "en-US"
});
const listenerCleanups: Array<() => void> = [];

const loadConfig = () => {
  loading.value = true;
  send(ipcRouters.SYSTEM.getSystemConfig);
};

// 系统设置为全局开关，修改后立即保存
const handleChange = useDebounceFn(() => {
  saving.value = true;
  send(ipcRouters.SYSTEM.saveSystemConfig, { ...formData.value });
}, 200);

const handleOpenDataFolder = useDebounceFn(() => {
  send(ipcRouters.SYSTEM.openAppData);
}, 300);

const handleResetAll = () => {
  ElMessageBox.confirm(
    t("system.alert.resetAll.message"),
    t("system.alert.resetAll.title"),
    {
      type: "warning",
      confirmButtonText: t("system.alert.resetAll.confirm"),
      confirmButtonClass: "el-button--danger",
      cancelButtonText: t("system.alert.resetAll.cancel")
    }
  )
    .then(() => send(ipcRouters.SERVER.resetAllConfig))
    .catch(() => {});
};

onMounted(() => {
  listenerCleanups.push(
    on(ipcRouters.SYSTEM.getSystemConfig, (data: FrpcSystemConfiguration) => {
      if (data) formData.value = data;
      loading.value = false;
    })
  );
  listenerCleanups.push(
    on(
      ipcRouters.SYSTEM.saveSystemConfig,
      () => {
        saving.value = false;
        ElMessage({
          type: "success",
          message: t("config.message.saveSuccess")
        });
        frpcDesktopStore.getLanguage();
      },
      (_bizCode: string, message: string) => {
        saving.value = false;
        ElMessage({ type: "error", message });
        loadConfig();
      }
    )
  );
  listenerCleanups.push(
    on(ipcRouters.SYSTEM.openAppData, () => {
      ElMessage({
        type: "success",
        message: t("config.message.openAppDataSuccess")
      });
    })
  );
  listenerCleanups.push(
    on(ipcRouters.SERVER.resetAllConfig, () => {
      ElMessageBox.alert(
        t("config.alert.resetConfigSuccess.message"),
        t("config.alert.resetConfigSuccess.title"),
        {
          closeOnClickModal: false,
          showClose: false,
          confirmButtonText: t("config.alert.resetConfigSuccess.confirm")
        }
      ).then(() => {
        send(ipcRouters.SYSTEM.relaunchApp);
      });
    })
  );
  loadConfig();
});

onUnmounted(() => {
  listenerCleanups.splice(0).forEach(off => off());
});
</script>

<template>
  <div class="main">
    <Breadcrumb>
      <el-button
        :aria-label="t('config.button.manualRefresh')"
        :title="t('config.button.manualRefresh')"
        @click="loadConfig"
      >
        <IconifyIconOffline icon="refresh-rounded" />
      </el-button>
    </Breadcrumb>
    <div v-loading="loading" class="pr-2 app-container-breadcrumb">
      <div class="p-4 w-full app-panel">
        <el-form
          :model="formData"
          :disabled="saving"
          label-position="right"
          label-width="150"
        >
          <el-row :gutter="10">
            <el-col :span="24">
              <div class="h2">{{ t("config.title.systemConfiguration") }}</div>
            </el-col>
            <el-col
              v-for="item in [
                { key: 'launchAtStartup', i18n: 'systemLaunchAtStartup' },
                { key: 'silentStartup', i18n: 'systemSilentStartup' },
                {
                  key: 'autoConnectOnStartup',
                  i18n: 'systemAutoConnectOnStartup'
                }
              ] as const"
              :key="item.key"
              :xs="24"
              :md="8"
            >
              <el-form-item :label="t(`config.form.${item.i18n}.label`)">
                <template #label>
                  <div class="flex items-center mr-1 h-full">
                    <el-popover placement="top" width="300" trigger="hover">
                      <template #default>
                        <div v-html="t(`config.form.${item.i18n}.tips`)"></div>
                      </template>
                      <template #reference>
                        <IconifyIconOffline
                          class="text-base"
                          color="var(--app-primary-text)"
                          icon="info"
                        />
                      </template>
                    </el-popover>
                  </div>
                  {{ t(`config.form.${item.i18n}.label`) }}
                </template>
                <el-switch
                  v-model="formData[item.key]"
                  :active-text="t('common.yes')"
                  :inactive-text="t('common.no')"
                  inline-prompt
                  @change="handleChange"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item :label="t('config.form.systemLanguage.label')">
                <el-select
                  v-model="formData.language"
                  class="!w-[200px]"
                  @change="handleChange"
                >
                  <el-option label="中文" value="zh-CN" />
                  <el-option label="English" value="en-US" />
                </el-select>
              </el-form-item>
            </el-col>

            <el-col :span="24">
              <div class="h2">{{ t("system.title.data") }}</div>
            </el-col>
            <el-col :span="24">
              <el-form-item :label="t('config.button.openData')">
                <el-button @click="handleOpenDataFolder">
                  <template #icon>
                    <IconifyIconOffline icon="folder-rounded" />
                  </template>
                  {{ t("config.button.openData") }}
                </el-button>
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item :label="t('config.button.resetAll')">
                <div class="flex flex-col gap-1 items-start">
                  <el-button type="danger" plain @click="handleResetAll">
                    <template #icon>
                      <IconifyIconOffline icon="deviceReset" />
                    </template>
                    {{ t("config.button.resetAll") }}
                  </el-button>
                  <span class="text-xs leading-5 text-text_color_secondary">
                    {{ t("system.resetAllHint") }}
                  </span>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>
    </div>
  </div>
</template>
