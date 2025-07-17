import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";

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
          title: "router.home.title",
          icon: "rocket-launch-rounded",
          keepAlive: true
        },
        component: () => import("@/views/home/index.vue")
      },
      {
        path: "/server",
        name: "Server",
        meta: {
          title: "router.server.title",
          icon: "cloud",
          keepAlive: true
        },
        component: () => import("@/views/server/index.vue")
      },
      {
        path: "/proxy",
        name: "Proxy",
        meta: {
          title: "router.proxy.title",
          icon: "network-node",
          keepAlive: true
        },
        component: () => import("@/views/proxy/index.vue")
      },
      {
        path: "/download",
        name: "Download",
        meta: {
          title: "router.download.title",
          icon: "download",
          keepAlive: true
        },
        component: () => import("@/views/download/index.vue")
      },
      {
        path: "/config",
        name: "Config",
        meta: {
          title: "router.config.title",
          icon: "settings",
          keepAlive: true
        },
        component: () => import("@/views/config/index.vue")
      },
      {
        path: "/logger",
        name: "Logger",
        meta: {
          title: "router.logger.title",
          icon: "file-copy-sharp",
          keepAlive: true,
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
          keepAlive: true,
          hidden: true
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
