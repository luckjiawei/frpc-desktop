<script lang="ts" setup>
import { useClipboard, useDebounceFn } from "@vueuse/core";
import { ElMessage } from "element-plus";
import { computed, defineComponent, ref } from "vue";
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
const { copy } = useClipboard();
// 搜索关键词输入值
const searchInput = ref("");
const searchKeyword = ref("");
const logContentRef = ref<HTMLElement>();
const filteredLogRecords = computed<Array<LogRecord>>(() => {
  if (!searchKeyword.value) {
    return props.logRecords;
  }
  return props.logRecords.filter(
    record => record.context.indexOf(searchKeyword.value) !== -1
  );
});

// 使用节流函数处理搜索输入
const throttledSearch = useDebounceFn((value: string) => {
  searchKeyword.value = value;
}, 300);

// 处理输入事件
const handleSearchInput = (value: string) => {
  searchInput.value = value;
  throttledSearch(value);
};

const getSelectedLogText = () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !logContentRef.value) {
    return "";
  }

  const selectedText = selection.toString().trim();
  if (!selectedText) {
    return "";
  }

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range) {
    return "";
  }

  const selectedInLogContent =
    logContentRef.value.contains(range.commonAncestorContainer) ||
    logContentRef.value === range.commonAncestorContainer;

  return selectedInLogContent ? selectedText : "";
};

const copyLogContent = async () => {
  const selectedText = getSelectedLogText();
  const text =
    selectedText ||
    filteredLogRecords.value.map(record => record.context).join("\n");

  if (!text.trim()) {
    ElMessage({
      type: "warning",
      message: t("logger.message.copyEmpty")
    });
    return;
  }

  await copy(text);
  ElMessage({
    type: "success",
    message: selectedText
      ? t("logger.message.copySelectionSuccess")
      : t("logger.message.copyAllSuccess")
  });
};
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
          @input="handleSearchInput"
        />
      </div>
      <div class="flex gap-3 items-center">
        <el-tooltip
          :content="t('logger.tooltip.copyLog')"
          placement="bottom"
        >
          <IconifyIconOffline
            class="text-gray-400 transition-colors duration-200 cursor-pointer hover:text-gray-300"
            icon="content-copy"
            @mousedown.prevent
            @click="copyLogContent"
          />
        </el-tooltip>
        <slot name="toolbar"></slot>
      </div>
    </div>

    <!-- 日志内容区域 -->
    <div
      ref="logContentRef"
      v-loading="loading"
      :element-loading-text="t('logger.loading.text')"
      element-loading-background="rgba(15, 15, 35, 0.8)"
      class="log-content overflow-y-auto flex-1 p-2 w-full rounded drop-shadow-lg"
    >
      <div
        v-for="record in filteredLogRecords"
        :key="record.id"
        class="log-line overflow-hidden w-full break-words"
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

.log-content,
.log-content * {
  -webkit-touch-callout: default;
  -webkit-user-select: text;
  -khtml-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

.log-content {
  cursor: text;
}

.log-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
