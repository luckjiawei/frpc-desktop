<script lang="ts" setup>
import Breadcrumb from "@/layout/compoenets/Breadcrumb.vue";
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { defineComponent } from "vue";
import { useVersions } from "./index";

defineComponent({
  name: "Versions"
});

const {
  t,
  versions,
  loading,
  downloading,
  handleDownload,
  handleCopyDownloadLink,
  handleDeleteVersion,
  handleImportFrp
} = useVersions();
</script>
<template>
  <div class="main">
    <breadcrumb>
      <div class="flex">
        <el-button type="primary" @click="handleImportFrp">
          <template #icon>
            <IconifyIconOffline icon="unarchive" />
          </template>
          {{ t("download.button.import") }}
        </el-button>
      </div>
    </breadcrumb>
    <div v-loading="loading > 0" class="pr-2 app-container-breadcrumb">
      <div class="w-full">
        <template v-if="versions && versions.length > 0">
          <el-row :gutter="15">
            <el-col
              v-for="version in versions"
              :key="version.githubAssetId"
              :lg="6"
              :md="8"
              :sm="12"
              :xl="6"
              :xs="12"
              class="mb-[15px]"
            >
              <div
                class="flex justify-between items-center p-4 w-full bg-white rounded drop-shadow left-border animate__animated"
              >
                <div class="left">
                  <div class="flex items-center">
                    <span class="mr-2 font-bold text-primary">{{
                      version.name
                    }}</span>
                  </div>
                  <div class="mb-1">
                    <el-tag size="small"> {{ version.size }}</el-tag>
                  </div>
                  <div class="text-[12px]">
                    <span class="">{{
                      t("download.version.downloadCount")
                    }}</span>
                    <span class="font-bold text-primary">{{
                      version.versionDownloadCount
                    }}</span>
                  </div>
                  <div class="text-[12px]">
                    {{ t("download.version.publishTime")
                    }}<span class="font-bold text-primary">{{
                      version.githubCreatedAt
                    }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 items-end right">
                  <template v-if="version.downloaded">
                    <el-button type="text" size="small">
                      <template #icon>
                        <IconifyIconOffline icon="check-box" />
                      </template>
                      {{ t("download.version.downloaded") }}
                    </el-button>
                    <el-button
                      type="text"
                      size="small"
                      class="danger-text"
                      @click="handleDeleteVersion(version)"
                    >
                      <template #icon>
                        <IconifyIconOffline icon="delete-rounded" />
                      </template>
                      {{ t("common.delete") }}
                    </el-button>
                  </template>

                  <template v-else>
                    <div
                      v-if="downloading.has(version.githubReleaseId)"
                      class="w-32"
                    >
                      <el-progress
                        :percentage="downloading.get(version.githubReleaseId)"
                        :text-inside="false"
                      />
                    </div>
                    <el-button
                      v-else
                      size="small"
                      type="text"
                      @click="handleDownload(version)"
                    >
                      <template #icon>
                        <IconifyIconOffline icon="download" />
                      </template>
                      {{ t("download.version.download") }}
                    </el-button>

                    <el-button
                      type="text"
                      size="small"
                      @click="handleCopyDownloadLink(version)"
                    >
                      <template #icon>
                        <IconifyIconOffline icon="link" /> </template
                      >{{ t("download.version.downloadLink") }}
                    </el-button>
                  </template>
                </div>
              </div>
            </el-col>
          </el-row>
        </template>
        <div
          v-else
          class="flex overflow-hidden justify-center items-center p-2 w-full h-full bg-white rounded drop-shadow-xl"
        >
          <el-empty :description="t('download.version.noVersions')" />
        </div>
      </div>
    </div>
  </div>
</template>
