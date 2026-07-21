import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import "animate.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import {
  IconifyIconOffline,
  IconifyIconOnline
} from "./components/IconifyIcon";
import i18n from "./lang";
import router from "./router";
import { useSystemUsageStore } from "./store/systemUsage";
import "./styles/index.scss";

const pinia = createPinia();

const app = createApp(App);
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);

app
  .use(i18n)
  .use(router)
  .use(pinia)
  .mount("#app")
  .$nextTick(() => {
    const frpcDesktopStore = useFrpcDesktopStore();
    frpcDesktopStore.onListenerFrpcProcessRunning();
    frpcDesktopStore.onListenerDownloadedVersion();
    frpcDesktopStore.onListenerFrpcDesktopGithubLastRelease();
    frpcDesktopStore.onListenerFrpcDesktopLanguage();
    frpcDesktopStore.getLanguage();

    const systemUsageStore = useSystemUsageStore();
    systemUsageStore.onListenerSystemUsage();

    postMessage({ payload: "removeLoading" }, "*");

    setTimeout(() => {
      frpcDesktopStore.refreshDownloadedVersion();
      frpcDesktopStore.checkNewVersion(false);
    }, 1000);
  })
  .then(r => {});
