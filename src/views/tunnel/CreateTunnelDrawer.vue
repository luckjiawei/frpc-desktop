<script lang="ts" setup>
import cloudflareLogo from "@/assets/cloudflare.svg";
import frpLogo from "@/assets/frp.svg";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { ipcRouters } from "@/core/IpcRouter";
import { request } from "@/utils/ipcUtils";
import { decodeConfigLink } from "@/utils/configLink";
import { useI18n } from "vue-i18n";
import { ElMessage, FormInstance, FormRules } from "element-plus";
import { computed, nextTick, reactive, ref, watch } from "vue";

type CreateMethod = "manual" | "toml" | "link";

const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  created: [tunnel: Tunnel];
}>();

const { t } = useI18n();
const formRef = ref<FormInstance>();
const form = reactive({
  name: "",
  link: ""
});
const provider = ref<TunnelProvider>("frpc");
const method = ref<CreateMethod>("manual");
const submitting = ref(false);

const isFrpc = computed(() => provider.value === "frpc");
const usesLink = computed(() => isFrpc.value && method.value === "link");

const providerOptions = [
  {
    value: "frpc" as const,
    logo: frpLogo,
    label: "tunnel.provider.frpc",
    description: "tunnel.provider.frpcDescription"
  },
  {
    value: "cloudflared" as const,
    logo: cloudflareLogo,
    label: "tunnel.provider.cloudflared",
    description: "tunnel.provider.cloudflaredDescription"
  }
];

const methodOptions = [
  {
    value: "manual" as const,
    icon: "edit",
    label: "tunnel.create.manual",
    description: "tunnel.create.manualDescription"
  },
  {
    value: "toml" as const,
    icon: "file-open-rounded",
    label: "tunnel.create.toml",
    description: "tunnel.create.tomlDescription"
  },
  {
    value: "link" as const,
    icon: "link",
    label: "tunnel.create.link",
    description: "tunnel.create.linkDescription"
  }
];

const rules: FormRules = {
  name: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        const name = (value ?? "").trim();
        callback(
          name.length > 0 && name.length <= 64
            ? undefined
            : new Error(t("tunnel.prompt.nameInvalid"))
        );
      },
      trigger: "blur"
    }
  ],
  link: [
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (!usesLink.value) {
          callback();
          return;
        }
        try {
          decodeConfigLink(value ?? "");
          callback();
        } catch {
          callback(new Error(t("tunnel.create.linkInvalid")));
        }
      },
      trigger: "blur"
    }
  ]
};

const submitLabel = computed(() => {
  if (!isFrpc.value) return t("tunnel.create.submitManual");
  if (method.value === "toml") return t("tunnel.create.submitToml");
  if (method.value === "link") return t("tunnel.create.submitLink");
  return t("tunnel.create.submitManual");
});

const reset = () => {
  form.name = "";
  form.link = "";
  provider.value = "frpc";
  method.value = "manual";
  submitting.value = false;
  formRef.value?.clearValidate();
};

watch(visible, open => {
  if (!open) return;
  reset();
  nextTick(() => formRef.value?.clearValidate());
});

watch([provider, method], () => {
  formRef.value?.clearValidate("link");
});

const requireSuccess = <T,>(response: ApiResponse<T>): T => {
  if (response.bizCode !== "A1000" || !response.data) {
    throw new Error(response.message || t("tunnel.create.failed"));
  }
  return response.data;
};

const submit = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await formRef.value?.validate();
  } catch {
    submitting.value = false;
    return;
  }

  const name = form.name.trim();
  const selectedMethod = isFrpc.value ? method.value : "manual";
  try {
    let tunnel: Tunnel;
    if (selectedMethod === "toml") {
      const result = requireSuccess(
        await request<TomlImportResult>(ipcRouters.TUNNEL.importTomlConfig, {
          name
        })
      );
      if (result.canceled !== false) {
        // The file picker was canceled; keep the drawer open.
        return;
      }
      tunnel = result.tunnel;
    } else if (selectedMethod === "link") {
      let payload: string;
      try {
        payload = JSON.stringify(decodeConfigLink(form.link));
      } catch {
        ElMessage.error(t("tunnel.create.linkInvalid"));
        return;
      }
      const response = await request<Tunnel>(
        ipcRouters.TUNNEL.importLinkConfig,
        { name, payload }
      );
      if (response.bizCode === "B1009") {
        throw new Error(t("tunnel.create.linkInvalid"));
      }
      tunnel = requireSuccess(response);
    } else {
      tunnel = requireSuccess(
        await request<Tunnel>(ipcRouters.TUNNEL.create, {
          name,
          provider: provider.value
        })
      );
    }

    ElMessage.success(
      t(
        selectedMethod === "manual"
          ? "tunnel.message.createSuccess"
          : "tunnel.message.importSuccess"
      )
    );
    visible.value = false;
    emit("created", tunnel);
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : t("tunnel.create.failed")
    );
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <el-drawer
    v-model="visible"
    class="create-drawer"
    size="min(560px, 92%)"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
  >
    <template #header="{ titleId, titleClass }">
      <h2 :id="titleId" :class="titleClass">{{ t("tunnel.create.title") }}</h2>
    </template>

    <div class="create-body pr-2">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent
      >
        <el-form-item :label="t('tunnel.create.name')" prop="name">
          <el-input
            v-model="form.name"
            maxlength="64"
            show-word-limit
            :placeholder="t('tunnel.create.namePlaceholder')"
            :disabled="submitting"
          />
        </el-form-item>

        <el-form-item :label="t('tunnel.create.provider')">
          <div class="create-options" role="radiogroup">
            <button
              v-for="item in providerOptions"
              :key="item.value"
              type="button"
              class="create-option"
              :class="{ 'is-active': provider === item.value }"
              role="radio"
              :aria-checked="provider === item.value"
              :disabled="submitting"
              @click="provider = item.value"
            >
              <span class="create-option__logo" aria-hidden="true">
                <img :src="item.logo" alt="" />
              </span>
              <span class="create-option__text">
                <strong>{{ t(item.label) }}</strong>
                <small>{{ t(item.description) }}</small>
              </span>
              <IconifyIconOffline
                v-if="provider === item.value"
                class="create-option__check"
                icon="check-circle-rounded"
              />
            </button>
          </div>
        </el-form-item>

        <template v-if="isFrpc">
          <el-form-item :label="t('tunnel.create.method')">
            <div class="create-methods" role="radiogroup">
              <button
                v-for="item in methodOptions"
                :key="item.value"
                type="button"
                class="create-method"
                :class="{ 'is-active': method === item.value }"
                role="radio"
                :aria-checked="method === item.value"
                :disabled="submitting"
                @click="method = item.value"
              >
                <IconifyIconOffline
                  class="create-method__icon"
                  :icon="item.icon"
                />
                <span class="create-option__text">
                  <strong>{{ t(item.label) }}</strong>
                  <small>{{ t(item.description) }}</small>
                </span>
                <IconifyIconOffline
                  v-if="method === item.value"
                  class="create-option__check"
                  icon="check-circle-rounded"
                />
              </button>
            </div>
          </el-form-item>

          <el-form-item v-if="method === 'toml'">
            <div class="create-hint">
              <IconifyIconOffline icon="file-open-rounded" />
              <span>{{ t("tunnel.create.tomlHint") }}</span>
            </div>
          </el-form-item>

          <el-form-item
            v-if="method === 'link'"
            :label="t('tunnel.create.linkLabel')"
            prop="link"
          >
            <el-input
              v-model="form.link"
              type="textarea"
              :rows="4"
              :placeholder="t('tunnel.create.linkPlaceholder')"
              :disabled="submitting"
            />
          </el-form-item>
        </template>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitting" @click="visible = false">
        <IconifyIconOffline class="mr-2" icon="cancel-presentation" />
        {{ t("common.cancel") }}
      </el-button>
      <el-button type="primary" :loading="submitting" @click="submit">
        <IconifyIconOffline class="mr-2" icon="add" />
        {{ submitLabel }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.create-body {
  padding-bottom: 8px;
}

.create-options {
  display: grid;
  gap: 8px;
  width: 100%;
}

.create-option {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  &.is-active {
    color: var(--app-primary-text);
    background: var(--app-primary-soft);
    border-color: var(--el-color-primary-light-5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--app-primary-text);
    outline-offset: 2px;
  }
}

.create-option__logo {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.create-option__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    font-size: 14px;
    font-weight: 600;
  }

  small {
    font-size: 12px;
    line-height: 1.4;
    color: var(--app-text-secondary);
  }
}

.create-option__check {
  flex: none;
  font-size: 18px;
}

.create-methods {
  display: grid;
  gap: 8px;
  width: 100%;
}

.create-method {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  &.is-active {
    color: var(--app-primary-text);
    background: var(--app-primary-soft);
    border-color: var(--el-color-primary-light-5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--app-primary-text);
    outline-offset: 2px;
  }
}

.create-method__icon {
  flex: none;
  font-size: 20px;
}

.create-hint {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-secondary);
}
</style>

<style lang="scss">
/* 抽屉挂载到 body，scoped 样式无法作用到它的头部和底部 */
.create-drawer {
  .el-drawer__header {
    gap: 12px;
    margin-bottom: 0;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--app-border);
  }

  .el-drawer__footer {
    padding-top: 12px;
    border-top: 1px solid var(--app-border);
  }
}
</style>
