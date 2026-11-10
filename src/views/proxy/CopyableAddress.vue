<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useClipboard } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  address: string;
  link?: boolean;
}>();
const { t } = useI18n();
const { copy } = useClipboard({ legacy: true });

const handleCopy = async () => {
  try {
    await copy(props.address);
    ElMessage({
      type: "success",
      message: t("proxy.message.copySuccess")
    });
  } catch {
    ElMessage({
      type: "error",
      message: t("proxy.message.copyFailed")
    });
  }
};
</script>

<template>
  <span class="copyable-address" :class="{ 'is-link': link }">
    <span class="copyable-address__text" :title="address">{{ address }}</span>
    <button
      type="button"
      class="copyable-address__btn"
      :aria-label="`${t('proxy.copyAddress')} ${address}`"
      :title="t('proxy.copyAddress')"
      @click.stop="handleCopy"
    >
      <IconifyIconOffline icon="content-copy" />
    </button>
  </span>
</template>

<style lang="scss" scoped>
.copyable-address {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  font-family: var(--app-mono);

  &.is-link .copyable-address__text {
    color: var(--app-primary-text);
  }
}

.copyable-address__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copyable-address__btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  cursor: pointer;
  opacity: 0.6;
  transition:
    opacity 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;

  &:hover,
  &:focus-visible {
    opacity: 1;
    color: var(--el-color-primary);
    background-color: var(--el-fill-color-light);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 1px;
  }
}
</style>
