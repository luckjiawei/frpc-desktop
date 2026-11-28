import { createI18n } from "vue-i18n";
import enUS from "./en-US";
import zhCN from "./zh-CN";
import zhTW from "./zh-TW";

const messages = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en-US": enUS
};

const i18n = createI18n({
  locale: "en-US",
  messages
});

export default i18n;
