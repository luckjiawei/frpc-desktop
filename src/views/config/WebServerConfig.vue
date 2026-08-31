<script lang="ts" setup>
import IconifyIconOffline from "@/components/IconifyIcon/src/iconifyIconOffline";
import { useI18n } from "vue-i18n";

const formData = defineModel<OpenSourceFrpcDesktopServer>({ required: true });
const { t } = useI18n();
</script>

<template>
  <el-col :span="24">
    <div class="h2">{{ t("config.title.webInterface") }}</div>
  </el-col>
  <el-col :span="12">
    <el-form-item
      :label="t('config.form.webServerPort.label')"
      prop="webServer.port"
    >
      <template #label>
        <div class="flex items-center mr-1 h-full">
          <el-popover width="300" placement="top" trigger="hover">
            <template #default>
              <div
                v-html="
                  t('config.form.webServerPort.tips', {
                    frpParameter: t('config.popover.frpParameter')
                  })
                "
              ></div>
            </template>
            <template #reference>
              <IconifyIconOffline
                class="text-base"
                color="#5A3DAA"
                icon="info"
              />
            </template>
          </el-popover>
        </div>
        {{ t("config.form.webServerPort.label") }}
      </template>
      <el-input-number
        v-model="formData.webServer.port"
        placeholder="57400"
        :min="0"
        :max="65535"
        controls-position="right"
        class="w-full"
      />
    </el-form-item>
  </el-col>
</template>
