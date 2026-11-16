<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { ipcRouters } from "@/core/IpcRouter";
import { useTunnelStore } from "@/store/tunnel";
import { request } from "@/utils/ipcUtils";

const props = defineProps<{
  tunnel: Pick<TunnelSummary, "id" | "name" | "autoStart">;
}>();
const dirty = defineModel<boolean>("dirty", { required: true });
const { t } = useI18n();
const tunnelStore = useTunnelStore();
const formRef = ref<FormInstance>();
const saving = ref(false);
const savedSettings = ref({
  name: props.tunnel.name,
  autoStart: props.tunnel.autoStart
});
const settings = ref({ ...savedSettings.value });
const currentTunnel = computed(
  () =>
    tunnelStore.tunnels.find(item => item.id === props.tunnel.id) ??
    props.tunnel
);
const rules = computed<FormRules>(() => ({
  name: [
    {
      validator: (_rule, value: string, callback) => {
        const name = value.trim();
        callback(
          name.length > 0 && name.length <= 64
            ? undefined
            : new Error(t("tunnel.prompt.nameInvalid"))
        );
      },
      trigger: "blur"
    }
  ]
}));

watch(
  currentTunnel,
  tunnel => {
    if (dirty.value) return;
    savedSettings.value = { name: tunnel.name, autoStart: tunnel.autoStart };
    settings.value = { ...savedSettings.value };
  },
  { immediate: true }
);
watch(
  [settings, savedSettings],
  ([value, saved]) => {
    dirty.value =
      value.name !== saved.name || value.autoStart !== saved.autoStart;
  },
  { deep: true }
);

const handleSave = async () => {
  if (saving.value) return;
  saving.value = true;
  try {
    if (!(await formRef.value?.validate().catch(() => false))) return;
    const response = await request<Tunnel>(ipcRouters.TUNNEL.update, {
      tunnelId: props.tunnel.id,
      name: settings.value.name.trim(),
      autoStart: settings.value.autoStart
    });
    if (response.bizCode !== "A1000") {
      ElMessage({ type: "error", message: response.message });
      return;
    }
    savedSettings.value = {
      name: response.data.name,
      autoStart: response.data.autoStart
    };
    settings.value = { ...savedSettings.value };
    dirty.value = false;
    const existing = tunnelStore.tunnels.find(
      item => item.id === response.data.id
    );
    if (existing) Object.assign(existing, response.data);
    tunnelStore.refreshTunnels();
    ElMessage({ type: "success", message: t("tunnel.message.settingsSaved") });
  } catch (error) {
    ElMessage({ type: "error", message: String(error) });
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <section class="mb-4">
    <div class="h2">{{ t("tunnel.config.settings") }}</div>
    <el-form
      ref="formRef"
      :model="settings"
      :rules="rules"
      label-position="top"
      :disabled="saving"
      @submit.prevent="handleSave"
    >
      <el-form-item :label="t('tunnel.prompt.nameLabel')" prop="name">
        <el-input
          v-model="settings.name"
          maxlength="64"
          show-word-limit
          :placeholder="t('tunnel.prompt.namePlaceholder')"
          @keydown.enter.prevent="handleSave"
        />
      </el-form-item>
      <el-form-item :label="t('tunnel.autoStart')">
        <div class="flex flex-wrap gap-2 items-center">
          <el-switch
            v-model="settings.autoStart"
            :aria-label="t('tunnel.autoStart')"
          />
          <span class="text-xs text-text_color_secondary">
            {{ t("tunnel.autoStartHint") }}
          </span>
        </div>
      </el-form-item>
      <el-button :loading="saving" :disabled="!dirty" @click="handleSave">
        {{ t("tunnel.config.saveSettings") }}
      </el-button>
    </el-form>
  </section>
</template>
