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
import { installElementPlus } from "./plugins/elementPlus";
import router from "./router";
import { useSystemUsageStore } from "./store/systemUsage";
import "./styles/index.scss";

const pinia = createPinia();

const app = createApp(App);
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);
installElementPlus(app);

app
  .use(i18n)
  .use(router)
  .use(pinia)
  .mount("#app")
  .$nextTick(() => {
    const frpcDesktopStore = useFrpcDesktopStore();
    frpcDesktopStore.onListenerFrpcProcessRunning();
    frpcDesktopStore.refreshRunning();
    frpcDesktopStore.onListenerDownloadedVersion();
    frpcDesktopStore.onListenerFrpcDesktopGithubLastRelease();
    frpcDesktopStore.refreshDownloadedVersion();
    window.setTimeout(() => {
      frpcDesktopStore.checkNewVersion(false);
    }, 4000);
    frpcDesktopStore.onListenerFrpcDesktopLanguage();
    frpcDesktopStore.getLanguage();

    const systemUsageStore = useSystemUsageStore();
    systemUsageStore.onListenerSystemUsage();

    postMessage({ payload: "removeLoading" }, "*");
  })
  .then(r => {});
