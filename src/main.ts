import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles/index.scss";
import "animate.css";
import i18n from "./lang";
import ElementPlus from "element-plus";
import {
  IconifyIconOffline,
  IconifyIconOnline
} from "./components/IconifyIcon";
import { createPinia } from "pinia";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";

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
    postMessage({ payload: "removeLoading" }, "*");
    const frpcDesktopStore = useFrpcDesktopStore();
    frpcDesktopStore.onListenerFrpcProcessRunning();
    frpcDesktopStore.onListenerDownloadedVersion();
    frpcDesktopStore.onListenerFrpcDesktopGithubLastRelease();
    frpcDesktopStore.refreshDownloadedVersion();
    frpcDesktopStore.checkNewVersion(false);
  })
  .then(r => {});

