import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles/index.scss";
import ElementPlus from "element-plus";

createApp(App)
  .use(router)
  .use(ElementPlus)
  .mount("#app")
  .$nextTick(() => {
    postMessage({ payload: "removeLoading" }, "*");
  });
