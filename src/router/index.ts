import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

const Layout = () => import("@/layout/index.vue");

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Index",
    component: Layout,
    redirect: "/launch",
    children: [
      {
        path: "/launch",
        name: "Launch",
        meta: {
          title: "router.home.title",
          icon: "rocket-launch-rounded",
          keepAlive: false
        },
        component: () => import("@/views/launch/index.vue")
      },
      {
        path: "/proxies",
        name: "Proxies",
        meta: {
          title: "router.proxy.title",
          icon: "cloud",
          keepAlive: false
        },
        component: () => import("@/views/proxies/index.vue")
      },
      {
        path: "/versions",
        name: "Versions",
        meta: {
          title: "router.download.title",
          icon: "download",
          keepAlive: false
        },
        component: () => import("@/views/versions/index.vue")
      },
      {
        path: "/config",
        name: "Config",
        meta: {
          title: "router.config.title",
          icon: "settings",
          keepAlive: false
        },
        component: () => import("@/views/config/index.vue")
      },
      {
        path: "/logger",
        name: "Logger",
        meta: {
          title: "router.logger.title",
          icon: "file-copy-sharp",
          keepAlive: false,
          hidden: false
        },
        component: () => import("@/views/logger/index.vue")
      },
      {
        path: "/about",
        name: "About",
        meta: {
          title: "router.about.title",
          icon: "info-sharp",
          keepAlive: false,
          hidden: false
        },
        component: () => import("@/views/about/index.vue")
      }
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
