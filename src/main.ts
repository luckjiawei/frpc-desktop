import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import "animate.css";
import ElementPlus from "element-plus";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import {
  IconifyIconOffline,
  IconifyIconOnline
} from "./components/IconifyIcon";
import i18n from "./lang";
import router from "./router";
import "./styles/index.scss";

const pinia = createPinia();

const app = createApp(App);
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);

app
  .use(i18n)
  .use(router)
  .use(ElementPlus)
  .use(pinia)
  .mount("#app")
  .$nextTick(() => {
    const frpcDesktopStore = useFrpcDesktopStore();
    frpcDesktopStore.onListenerFrpcProcessRunning();
    frpcDesktopStore.onListenerDownloadedVersion();
    frpcDesktopStore.onListenerFrpcDesktopGithubLastRelease();
    frpcDesktopStore.refreshDownloadedVersion();
    frpcDesktopStore.checkNewVersion(false);
    frpcDesktopStore.onListenerFrpcDesktopLanguage();
    frpcDesktopStore.getLanguage();
    postMessage({ payload: "removeLoading" }, "*");
  })
  .then(r => {});
