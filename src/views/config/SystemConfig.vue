<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useI18n } from "vue-i18n";
import { onMounted, onUnmounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { on, send } from "@/utils/ipcUtils";
import { ipcRouters } from "../../../electron/core/IpcRouter";

const formData = defineModel<OpenSourceFrpcDesktopServer>({ required: true });
const emit = defineEmits<{
  languageChange: [language: string];
}>();
const { t } = useI18n();
const service = ref<WindowsServiceStatus>();
const busy = ref(false);
const statusError = ref(false);
let pendingAction: WindowsServiceAction | null = null;
const disposers: Array<() => void> = [];
const refreshService = () => {
  busy.value = true;
  send(ipcRouters.SYSTEM.getWindowsServiceStatus);
};
const serviceFailure = (_code: string, message: string) => {
  busy.value = false;
  pendingAction = null;
  statusError.value = true;
  const key = `config.windowsService.errors.${message}`;
  const translated = t(key);
  ElMessage.error(
    translated === key ? t("config.windowsService.errors.default") : translated
  );
};
onMounted(() => {
  disposers.push(
    on(
      ipcRouters.SYSTEM.getWindowsServiceStatus,
      data => {
        service.value = data;
        busy.value = false;
        statusError.value = false;
      },
      serviceFailure
    )
  );
  disposers.push(
    on(
      ipcRouters.SYSTEM.manageWindowsService,
      data => {
        service.value = data;
        busy.value = false;
        statusError.value = false;
        pendingAction = null;
        ElMessage.success(t("config.windowsService.success"));
      },
      serviceFailure
    )
  );
  refreshService();
});
onUnmounted(() => disposers.forEach(dispose => dispose()));
const manageService = async (action: WindowsServiceAction) => {
  if (busy.value || pendingAction) return;
  if (["install", "sync", "uninstall"].includes(action)) {
    try {
      await ElMessageBox.confirm(
        t(`config.windowsService.confirm.${action}`),
        t("config.windowsService.title"),
        {
          type: action === "uninstall" ? "warning" : "info",
          confirmButtonText: t(`config.windowsService.actions.${action}`),
          cancelButtonText: t("common.cancel")
        }
      );
    } catch {
      return;
    }
  }
  pendingAction = action;
  busy.value = true;
  send(ipcRouters.SYSTEM.manageWindowsService, { action });
};
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
  <el-col v-if="service?.supported || statusError" :span="24">
    <div class="h3">{{ t("config.windowsService.title") }}</div>
    <el-form-item :label="t('config.windowsService.status')">
      <div class="flex flex-wrap items-center gap-2">
        <el-tag :type="service?.running ? 'success' : 'info'">
          {{
            t(
              `config.windowsService.states.${statusError ? "unknown" : (service?.state ?? "unknown")}`
            )
          }}
        </el-tag>
        <el-tooltip :content="t('config.windowsService.refresh')">
          <el-button
            :loading="busy"
            :disabled="busy"
            :aria-label="t('config.windowsService.refresh')"
            @click="refreshService"
          >
            <IconifyIconOffline icon="refresh-rounded" />
          </el-button>
        </el-tooltip>
      </div>
    </el-form-item>
    <el-form-item>
      <div class="flex flex-wrap gap-2">
        <el-button
          v-if="!service?.installed && service?.state !== 'cleanupRequired'"
          type="primary"
          :loading="busy"
          :disabled="busy || statusError"
          @click="manageService('install')"
        >
          <IconifyIconOffline icon="add" class="mr-1" />{{
            t("config.windowsService.actions.install")
          }}
        </el-button>
        <template v-else-if="service?.installed">
          <el-button
            type="primary"
            :loading="busy"
            :disabled="busy || statusError || service.state === 'pending'"
            @click="manageService(service.running ? 'stop' : 'start')"
          >
            <IconifyIconOffline
              :icon="
                service.running
                  ? 'cancel-presentation'
                  : 'rocket-launch-rounded'
              "
              class="mr-1"
            />{{
              t(
                `config.windowsService.actions.${service.running ? "stop" : "start"}`
              )
            }}
          </el-button>
          <el-button
            :disabled="busy || statusError || service.state === 'pending'"
            @click="manageService('sync')"
          >
            <IconifyIconOffline icon="file-save-rounded" class="mr-1" />{{
              t("config.windowsService.actions.sync")
            }}
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="busy || statusError || service.state === 'pending'"
            @click="manageService('uninstall')"
          >
            <IconifyIconOffline icon="delete-rounded" class="mr-1" />{{
              t("config.windowsService.actions.uninstall")
            }}
          </el-button>
        </template>
        <el-button
          v-else
          type="danger"
          plain
          :disabled="busy || statusError"
          @click="manageService('uninstall')"
        >
          <IconifyIconOffline icon="delete-rounded" class="mr-1" />{{
            t("config.windowsService.actions.uninstall")
          }}
        </el-button>
      </div>
    </el-form-item>
  </el-col>
</template>
