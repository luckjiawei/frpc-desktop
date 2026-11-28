import { createI18n } from "vue-i18n";
import enUS from "./en-US";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";

const messages = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en-US": enUS
};

export const defaultLanguage = "en-US";

/**
 * Newer releases may persist a language this build does not know. Normalizing
 * before saving system settings keeps unrelated setting changes valid after a
 * rollback instead of being rejected as an unsupported language.
 */
export const normalizeLanguage = (language?: string | null): string =>
  language && language in messages ? language : defaultLanguage;

const i18n = createI18n({
  locale: "en-US",
  messages
});

export default i18n;
