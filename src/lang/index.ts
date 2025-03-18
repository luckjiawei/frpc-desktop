import { createI18n } from "vue-i18n";
import zhCN from "./zh-CN";

const messages = {
  "zh-CN": zhCN
};

const i18n = createI18n({
  locale: "zh-CN",
  messages
});

export default i18n;
