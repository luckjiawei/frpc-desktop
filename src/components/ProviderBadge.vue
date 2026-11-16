<script lang="ts" setup>
import cloudflareLogo from "@/assets/cloudflare.svg";
import frpLogo from "@/assets/frp.svg";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    provider: TunnelProvider;
    size?: "small" | "default";
  }>(),
  { size: "default" }
);

const { t } = useI18n();

const logo = computed(() =>
  props.provider === "frpc" ? frpLogo : cloudflareLogo
);
</script>

<template>
  <span class="provider-badge" :class="[`is-${provider}`, `is-${size}`]">
    <span class="provider-badge__logo" aria-hidden="true">
      <img :src="logo" alt="" />
    </span>
    <span class="provider-badge__label">
      {{ t(`tunnel.provider.${provider}`) }}
    </span>
  </span>
</template>

<style scoped lang="scss">
.provider-badge {
  display: inline-flex;
  flex: none;
  gap: 5px;
  align-items: center;
  height: 24px;
  padding: 0 10px 0 5px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  background: var(--el-fill-color-light);
  border-radius: 999px;
  user-select: none;

  /* 品牌色只用于 logo 底色，文字使用主题色保证深浅模式可读 */
  &.is-frpc .provider-badge__logo {
    background: rgba(48, 127, 236, 0.14);
  }

  &.is-cloudflared .provider-badge__logo {
    background: rgba(244, 129, 31, 0.16);
  }

  &.is-small {
    gap: 4px;
    height: 20px;
    padding: 0 8px 0 4px;
    font-size: 11px;
  }
}

.provider-badge__logo {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;

  img {
    display: block;
    width: 12px;
    height: 12px;
    object-fit: contain;
  }

  .is-small & {
    width: 16px;
    height: 16px;

    img {
      width: 10px;
      height: 10px;
    }
  }
}

.provider-badge__label {
  line-height: 1;
}
</style>
