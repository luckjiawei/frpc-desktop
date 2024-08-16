import {createApp} from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles/index.scss";
import 'animate.css';
import ElementPlus from "element-plus";
import {
    IconifyIconOffline,
    IconifyIconOnline,
} from "./components/IconifyIcon";

const app = createApp(App);
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);


app.use(router)
    .use(ElementPlus)
    .mount("#app")
    .$nextTick(() => {
        postMessage({payload: "removeLoading"}, "*");
    });
