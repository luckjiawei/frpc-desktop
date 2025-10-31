<script lang="ts" setup>
import { defineComponent } from "vue";
import { LogLevel, LogRecord } from "./log";

defineComponent({
  name: "LogView"
});

defineProps<{
  logRecords: Array<LogRecord>;
  loading?: boolean;
}>();

defineEmits<{
  refresh: [];
  openFile: [];
}>();

import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div
    class="w-full h-full bg-[#0f0f23] flex flex-col rounded-lg overflow-hidden border border-[#2d3748] shadow-lg"
  >
    <!-- 工具栏插槽 -->
    <div
      class="flex justify-end w-full bg-gradient-to-r from-[#1a202c] to-[#2d3748] py-1 px-3 items-center gap-3 border-b border-[#4a5568]"
    >
      <slot name="toolbar"></slot>
    </div>

    <!-- 日志内容区域 -->
    <div class="overflow-y-auto flex-1 p-2 w-full rounded drop-shadow-lg">
      <div
        v-for="record in logRecords"
        :key="record.context"
        class="overflow-hidden w-full break-words"
      >
        <span v-if="record.level === LogLevel.ERROR" class="text-[#FF0006]">
          {{ record.context }}
        </span>
        <span v-else-if="record.level === LogLevel.INFO" class="text-[#48BB31]">
          {{ record.context }}
        </span>
        <span
          v-else-if="record.level === LogLevel.DEBUG"
          class="text-[#0070BB]"
        >
          {{ record.context }}
        </span>
        <span v-else-if="record.level === LogLevel.WARN" class="text-[#BBBB23]">
          {{ record.context }}
        </span>
        <span v-else class="text-[#BBBBBB]">
          {{ record.context }}
        </span>
      </div>
      <div
        v-if="logRecords.length === 0"
        class="flex justify-center items-center w-full h-full text-gray-400"
      >
        <!--
        <el-empty :image-size="80" :description="t('logger.content.empty')" />
        -->
        <span>{{ t("logger.content.empty") }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
::-webkit-scrollbar-track-piece {
  background-color: transparent;
}

:deep(.el-empty__image) {
  color: red;
}
</style>
