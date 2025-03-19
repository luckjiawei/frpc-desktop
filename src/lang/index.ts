import { createI18n } from "vue-i18n";
import enUS from "./en-US";
import zhCN from "./zh-CN";

const messages = {
  "zh-CN": zhCN,
  "en-US": enUS
};

const i18n = createI18n({
  locale: "en-US",
  messages
});

export default i18n;
