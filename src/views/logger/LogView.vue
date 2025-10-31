<script lang="ts" setup>
import { useDebounceFn } from "@vueuse/core";
import { defineComponent, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { LogLevel, LogRecord } from "./log";

defineComponent({
  name: "LogView"
});

const props = defineProps<{
  logRecords: Array<LogRecord>;
  loading?: boolean;
}>();

defineEmits<{
  refresh: [];
  openFile: [];
}>();

const { t } = useI18n();
// 搜索关键词输入值
const searchInput = ref("");
const searchKeyword = ref("");
// 过滤后的日志记录
const filteredLogRecords = ref<Array<LogRecord>>([]);

// 更新过滤后的日志
const updateFilteredLogs = () => {
  filteredLogRecords.value = props.logRecords.filter(
    record => record.context.indexOf(searchKeyword.value) !== -1
  );
};

// 使用节流函数处理搜索输入
const throttledSearch = useDebounceFn((value: string) => {
  searchKeyword.value = value;
  console.log(searchKeyword.value, "keyword");
  updateFilteredLogs();
}, 300);

// 处理输入事件
const handleSearchInput = (value: string) => {
  searchInput.value = value;
  throttledSearch(value);
};

// 初始化显示所有日志
filteredLogRecords.value = props.logRecords;

// 监听 logRecords 变化，自动更新过滤结果
watch(
  () => props.logRecords,
  () => {
    updateFilteredLogs();
  },
  { deep: true }
);
</script>

<template>
  <div
    class="w-full h-full bg-[#0f0f23] flex flex-col rounded-lg overflow-hidden border border-[#2d3748] shadow-lg"
  >
    <!-- 工具栏插槽 -->
    <div
      class="flex justify-between w-full bg-gradient-to-r from-[#1a202c] to-[#2d3748] py-2 px-3 items-center gap-3 border-b border-[#4a5568]"
    >
      <div class="">
        <el-input
          :model-value="searchInput"
          @input="handleSearchInput"
          size="small"
          class="search-input"
          :placeholder="t('logger.search.placeholder')"
          clearable
          style="
            --el-input-bg-color: #2d3748;
            --el-input-border-color: #4a5568;
            --el-input-text-color: #e2e8f0;
            --el-input-placeholder-color: #a0aec0;
          "
        />
      </div>
      <div class="flex gap-3 items-center">
        <slot name="toolbar"></slot>
      </div>
    </div>

    <!-- 日志内容区域 -->
    <div
      :element-loading-text="t('logger.loading.text')"
      element-loading-background="rgba(15, 15, 35, 0.8)"
      class="overflow-y-auto flex-1 p-2 w-full rounded drop-shadow-lg"
      v-loading="loading"
    >
      <div
        v-for="record in filteredLogRecords"
        :key="record.id"
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
        v-if="!loading && filteredLogRecords.length === 0"
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
