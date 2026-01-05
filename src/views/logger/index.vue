<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import { defineComponent, ref } from "vue";
import { useI18n } from "vue-i18n";
import LogView from "./LogView.vue";
import { useLogger } from ".";

defineComponent({
  name: "Logger"
});

const { t } = useI18n();

const {
  logRecords,
  logLoading,
  autoRefresh,
  autoRefreshTime,
  activeTabName,
  refreshLog,
  openLocalLog,
  handleAutoRefreshChange,
  handleTabChange
} = useLogger();
</script>
<template>
  <div class="main">
    <breadcrumb> </breadcrumb>
    <div class="app-container-breadcrumb">
      <el-tabs
        v-model="activeTabName"
        class="log-tabs"
        @tab-change="handleTabChange"
      >
        <el-tab-pane
          :label="t('logger.tab.appLog')"
          name="app_log"
          class="log-container"
        >
          <log-view :log-records="logRecords" :loading="logLoading">
            <template #toolbar>
              <span
                v-if="autoRefresh"
                class="text-sm font-medium text-gray-300"
                >{{
                  t("logger.autoRefreshTime", { time: autoRefreshTime })
                }}</span
              >
              <el-switch
                v-model="autoRefresh"
                size="small"
                class="text-gray-300"
                @change="handleAutoRefreshChange"
                >{{ t("logger.autoRefresh") }}</el-switch
              >
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="refresh-rounded"
                size="small"
                @click="refreshLog"
              />
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="file-open-rounded"
                @click="openLocalLog"
              />
            </template>
          </log-view>
        </el-tab-pane>
        <el-tab-pane
          :label="t('logger.tab.frpcLog')"
          name="frpc_log"
          class="log-container"
        >
          <log-view :log-records="logRecords" :loading="logLoading">
            <template #toolbar>
              <span
                v-if="autoRefresh"
                class="text-sm font-medium text-gray-300"
                >{{
                  t("logger.autoRefreshTime", { time: autoRefreshTime })
                }}</span
              >
              <el-switch
                v-model="autoRefresh"
                size="small"
                class="text-gray-300"
                @change="handleAutoRefreshChange"
                >{{ t("logger.autoRefresh") }}</el-switch
              >
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="refresh-rounded"
                size="small"
                @click="refreshLog"
              />
              <IconifyIconOffline
                class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
                icon="file-open-rounded"
                @click="openLocalLog"
              />
            </template>
          </log-view>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
::-webkit-scrollbar-track-piece {
  background-color: transparent;
}

.log-tabs {
  height: 100%;
}

.log-container {
  height: 100%;
}
</style>
