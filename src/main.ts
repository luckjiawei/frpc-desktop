import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles/index.scss";
import "animate.css";
import ElementPlus from "element-plus";
import {
  IconifyIconOffline,
  IconifyIconOnline
} from "./components/IconifyIcon";
import { createPinia } from "pinia";
import { on, onListener } from "@/utils/ipcUtils";
import { ipcRouters, listeners } from "../electron/core/IpcRouter";
import { useFrpcProcessStore } from "@/store/frpcProcess";

const pinia = createPinia();

const app = createApp(App);
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);

app
  .use(router)
  .use(ElementPlus)
  .use(pinia)
  .mount("#app")
  .$nextTick(() => {
    postMessage({ payload: "removeLoading" }, "*");

    const frpcProcessStore = useFrpcProcessStore();

    onListener(listeners.watchFrpcProcess, data => {
      console.log("watchFrpcProcess", data);
      frpcProcessStore.setRunning(data);
    });

    on(ipcRouters.LAUNCH.getStatus, data => {
      console.log("getStatus", data);
      frpcProcessStore.setRunning(data);
    });
  });

