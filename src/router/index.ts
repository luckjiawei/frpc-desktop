import { createRouter, createWebHistory, createWebHashHistory, RouteRecordRaw } from "vue-router";

const Layout = () => import("@/layout/index.vue");

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Index",
    component: Layout,
    redirect: "/home",
    children: [
      {
        path: "/home",
        name: "Home",
        meta: {
          title: "连接",
          icon: "material-symbols:rocket-launch-rounded",
          keepAlive: true
        },
        component: () => import("@/views/home/index.vue")
      },
      {
        path: "/proxy",
        name: "Proxy",
        meta: {
          title: "穿透列表",
          icon: "material-symbols:cloud",
          keepAlive: true
        },
        component: () => import("@/views/proxy/index.vue")
      },
      {
        path: "/download",
        name: "Download",
        meta: {
          title: "版本下载",
          icon: "material-symbols:download-2",
          keepAlive: true
        },
        component: () => import("@/views/download/index.vue")
      },
      {
        path: "/config",
        name: "Config",
        meta: {
          title: "系统配置",
          icon: "material-symbols:settings",
          keepAlive: true
        },
        component: () => import("@/views/config/index.vue")
      },
      {
        path: "/logger",
        name: "Logger",
        meta: {
          title: "日志",
          icon: "material-symbols:file-copy-sharp",
          keepAlive: true,
          hidden: false
        },
        component: () => import("@/views/logger/index.vue")
      },
      {
        path: "/about",
        name: "About",
        meta: {
          title: "关于",
          icon: "material-symbols:info-sharp",
          keepAlive: true,
          hidden: true
        },
        component: () => import("@/views/about/index.vue")
      },
      // {
      //   path: "/comingSoon",
      //   name: "ComingSoon",
      //   meta: {
      //     title: "敬请期待",
      //     icon: "material-symbols:file-copy-sharp",
      //     keepAlive: false,
      //     hidden: true
      //   },
      //   component: () => import("@/views/comingSoon/index.vue")
      // }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});
export default router;
