<script lang="ts" setup>
import {computed, defineComponent, onMounted, ref} from "vue";
import router from "@/router";
import {RouteRecordRaw} from "vue-router";
import pkg from '../../../package.json';


defineComponent({
  name: "AppMain"
});

const routes = ref<Array<RouteRecordRaw>>([]);

const currentRoute = computed(() => {
  return router.currentRoute.value;
});

/**
 * 菜单切换
 * @param mi 菜单索引
 */
const handleMenuChange = (route: any) => {
  if (currentRoute.value.name === route.name) {
    return;
  }
  router.push({
    path: route.path
  });
};

const handleOpenGitHubReleases = () => {
  // ipcRenderer.send("github.openReleases")
  router.push({
    name: "About"
  })
}


onMounted(() => {
  routes.value = router.options.routes[0].children?.filter(
      f => !f.meta?.hidden
  ) as Array<RouteRecordRaw>;
});
</script>

<template>
  <div class="left-menu-container drop-shadow-xl">
    <div class="logo-container">
      <img src="/logo/only/128x128.png" class="logo animate__animated animate__flip" alt="Logo"/>
    </div>
    <ul class="menu-container">
      <!--      enter-active-class="animate__animated animate__bounceIn"-->
      <!--      leave-active-class="animate__animated animate__fadeOut"-->
      <li
          class="menu animate__animated"
          :class="currentRoute?.name === r.name ? 'menu-selected' : ''"
          v-for="r in routes"
          :key="r.name"
          @click="handleMenuChange(r)"
      >
        <IconifyIconOffline class="animate__animated" :icon="r?.meta?.icon as string"></IconifyIconOffline>
      </li>
    </ul>
    <div class="version mb-2 animate__animated" @click="handleOpenGitHubReleases">
      {{ pkg.version }}
    </div>

  </div>
</template>
