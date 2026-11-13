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

const { t } = useI18n();
const { copy } = useClipboard();

const LEVEL_ORDER: Array<LogLevel> = [
  LogLevel.ERROR,
  LogLevel.WARN,
  LogLevel.INFO,
  LogLevel.DEBUG
];

const searchInput = ref("");
const searchKeyword = ref("");
const activeLevels = ref<Array<LogLevel>>([...LEVEL_ORDER]);
const wrapLines = ref(true);

const levelCounts = computed<Record<LogLevel, number>>(() => {
  const counts: Record<LogLevel, number> = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 0,
    [LogLevel.INFO]: 0,
    [LogLevel.DEBUG]: 0
  };
  for (const record of props.logRecords) {
    counts[record.level] += 1;
  }
  return counts;
});

const levelOptions = computed(() =>
  LEVEL_ORDER.filter(level => levelCounts.value[level] > 0).map(level => ({
    level,
    label: t(`logger.level.${level}`),
    count: levelCounts.value[level]
  }))
);

const allLevelsActive = computed(
  () =>
    levelOptions.value.length === 0 ||
    levelOptions.value.every(option =>
      activeLevels.value.includes(option.level)
    )
);

const searchMatchedRecords = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return props.logRecords;
  }
  return props.logRecords.filter(record =>
    record.context.toLowerCase().includes(keyword)
  );
});

const filteredLogRecords = computed(() =>
  searchMatchedRecords.value.filter(record =>
    activeLevels.value.includes(record.level)
  )
);

type TextSegment = { text: string; match: boolean };

const splitByKeyword = (text: string, keyword: string): Array<TextSegment> => {
  if (!keyword) {
    return [{ text, match: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const segments: Array<TextSegment> = [];
  let cursor = 0;
  let hit = lowerText.indexOf(lowerKeyword);

  while (hit !== -1) {
    if (hit > cursor) {
      segments.push({ text: text.slice(cursor, hit), match: false });
    }
    segments.push({
      text: text.slice(hit, hit + keyword.length),
      match: true
    });
    cursor = hit + keyword.length;
    hit = lowerText.indexOf(lowerKeyword, cursor);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
};

const displayRecords = computed(() => {
  const keyword = searchKeyword.value.trim();
  return filteredLogRecords.value.map(record => ({
    record,
    segments: splitByKeyword(record.message, keyword)
  }));
});

const toggleLevel = (level: LogLevel) => {
  activeLevels.value = activeLevels.value.includes(level)
    ? activeLevels.value.filter(item => item !== level)
    : [...activeLevels.value, level];
};

const selectAllLevels = () => {
  activeLevels.value = [...LEVEL_ORDER];
};

const resetFilters = () => {
  searchInput.value = "";
  searchKeyword.value = "";
  selectAllLevels();
};

const handleSearchInput = useDebounceFn((value: string) => {
  searchKeyword.value = value;
}, 200);

const copyVisibleLogs = () => {
  const text = filteredLogRecords.value
    .map(record => record.context)
    .join("\n");
  if (!text) {
    return;
  }
  copy(text);
  ElMessage({
    type: "success",
    message: t("logger.message.copySuccess")
  });
};

const levelLabel = (level: LogLevel) => level.toUpperCase();
</script>

<template>
  <div class="log-shell">
    <div class="log-toolbar">
      <div class="log-toolbar-left">
        <el-input
          v-model="searchInput"
          class="log-search"
          size="small"
          :placeholder="t('logger.search.placeholder')"
          :aria-label="t('logger.search.placeholder')"
          clearable
          @input="handleSearchInput"
        >
          <template #prefix>
            <IconifyIconOffline icon="search" />
          </template>
        </el-input>

        <div
          class="log-filters"
          role="group"
          :aria-label="t('logger.filter.label')"
        >
          <button
            type="button"
            class="log-chip log-chip-all"
            :class="{ 'is-active': allLevelsActive }"
            :aria-pressed="allLevelsActive"
            @click="selectAllLevels"
          >
            {{ t("logger.level.all") }}
            <span class="log-count">{{ logRecords.length }}</span>
          </button>
          <button
            v-for="option in levelOptions"
            :key="option.level"
            type="button"
            class="log-chip"
            :class="[
              `is-${option.level}`,
              { 'is-active': activeLevels.includes(option.level) }
            ]"
            :aria-pressed="activeLevels.includes(option.level)"
            @click="toggleLevel(option.level)"
          >
            <span class="log-dot" aria-hidden="true"></span>
            {{ option.label }}
            <span class="log-count">{{ option.count }}</span>
          </button>
        </div>
      </div>

      <div class="log-toolbar-right">
        <button
          type="button"
          class="log-icon-button"
          :class="{ 'is-active': wrapLines }"
          :aria-label="t('logger.toolbar.wrap')"
          :title="t('logger.toolbar.wrap')"
          :aria-pressed="wrapLines"
          @click="wrapLines = !wrapLines"
        >
          <IconifyIconOffline icon="wrap-text" />
        </button>
        <button
          type="button"
          class="log-icon-button"
          :aria-label="t('logger.toolbar.copy')"
          :title="t('logger.toolbar.copy')"
          :disabled="filteredLogRecords.length === 0"
          @click="copyVisibleLogs"
        >
          <IconifyIconOffline icon="content-copy" />
        </button>
        <span class="log-toolbar-divider" aria-hidden="true"></span>
        <slot name="toolbar"></slot>
      </div>
    </div>

    <div
      v-loading="loading"
      :element-loading-text="t('logger.loading.text')"
      element-loading-background="rgba(13, 17, 23, 0.72)"
      class="log-body"
      :class="{ 'is-wrapped': wrapLines }"
    >
      <div
        v-for="item in displayRecords"
        :key="item.record.id"
        class="log-line"
        :class="`is-${item.record.level}`"
      >
        <span v-if="item.record.timestamp" class="log-time">{{
          item.record.timestamp
        }}</span>
        <span class="log-level" :class="`is-${item.record.level}`">{{
          levelLabel(item.record.level)
        }}</span>
        <span v-if="item.record.source" class="log-source">{{
          item.record.source
        }}</span>
        <span class="log-message">
          <template v-for="(segment, index) in item.segments" :key="index">
            <mark v-if="segment.match" class="log-hit">{{ segment.text }}</mark>
            <template v-else>{{ segment.text }}</template>
          </template>
        </span>
      </div>

      <div v-if="!loading && displayRecords.length === 0" class="log-empty">
        <IconifyIconOffline
          icon="description"
          class="log-empty-icon"
          aria-hidden="true"
        />
        <p class="log-empty-text">
          {{
            logRecords.length === 0
              ? t("logger.content.empty")
              : t("logger.content.noMatch")
          }}
        </p>
        <button
          v-if="logRecords.length > 0"
          type="button"
          class="log-empty-action"
          @click="resetFilters"
        >
          {{ t("logger.filter.clear") }}
        </button>
      </div>
    </div>

    <div class="log-footer">
      <span>
        {{
          t("logger.status.showing", {
            shown: filteredLogRecords.length,
            total: logRecords.length
          })
        }}
      </span>
      <span v-if="searchKeyword.trim()" class="log-footer-keyword">
        {{ t("logger.status.searching", { keyword: searchKeyword.trim() }) }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.log-shell {
  --log-bg: #0d1117;
  --log-bg-elevated: #151a22;
  --log-border: #232a35;
  --log-text: #d7dee8;
  --log-muted: #8b95a7;
  --log-hover: rgba(255, 255, 255, 0.035);
  --log-error: #ff7b72;
  --log-warn: #e3b341;
  --log-info: #56d364;
  --log-debug: #79c0ff;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--log-text);
  background: var(--log-bg);
  border: 1px solid var(--log-border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}

.log-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--log-bg-elevated);
  border-bottom: 1px solid var(--log-border);
}

.log-toolbar-left,
.log-toolbar-right {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.log-search {
  width: 220px;
}

.log-search :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 0 1px var(--log-border) inset;
}

.log-search :deep(.el-input__wrapper.is-focus),
.log-search :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary-light-3) inset;
}

.log-search :deep(.el-input__inner) {
  color: var(--log-text);
}

.log-search :deep(.el-input__inner::placeholder) {
  color: var(--log-muted);
}

.log-search :deep(.el-input__prefix),
.log-search :deep(.el-input__suffix) {
  color: var(--log-muted);
}

.log-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.log-chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 26px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 500;
  color: var(--log-muted);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.log-chip:hover {
  color: var(--log-text);
  background: var(--log-hover);
}

.log-chip.is-active {
  color: var(--log-text);
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--log-border);
}

.log-chip:focus-visible,
.log-icon-button:focus-visible,
.log-empty-action:focus-visible {
  outline: 2px solid var(--el-color-primary-light-3);
  outline-offset: 1px;
}

.log-chip.is-error {
  --chip-color: var(--log-error);
}

.log-chip.is-warn {
  --chip-color: var(--log-warn);
}

.log-chip.is-info {
  --chip-color: var(--log-info);
}

.log-chip.is-debug {
  --chip-color: var(--log-debug);
}

.log-dot {
  width: 6px;
  height: 6px;
  background: var(--chip-color, var(--log-muted));
  border-radius: 50%;
}

.log-chip:not(.is-active) .log-dot {
  opacity: 0.4;
}

.log-count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--log-muted);
}

.log-toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--log-border);
}

.log-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--log-muted);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.log-icon-button:hover:not(:disabled) {
  color: var(--log-text);
  background: rgba(255, 255, 255, 0.06);
}

.log-icon-button.is-active {
  color: var(--log-text);
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--log-border);
}

.log-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.log-icon-button :deep(svg) {
  width: 16px;
  height: 16px;
}

.log-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  padding: 6px 0;
  overflow: auto;
  font-family:
    "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.7;
  /* The global reset disables selection; logs must stay copyable. */
  user-select: text;
  -webkit-user-select: text;
}

.log-body::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.log-body::-webkit-scrollbar-track {
  background: transparent;
}

.log-body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.25);
  background-clip: content-box;
  border: 3px solid transparent;
  border-radius: 999px;
}

.log-body::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.4);
  background-clip: content-box;
}

.log-line {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 1px 14px;
  border-left: 2px solid transparent;
}

.log-line:hover {
  background: var(--log-hover);
}

.log-line.is-error {
  background: rgba(255, 123, 114, 0.04);
  border-left-color: rgba(255, 123, 114, 0.5);
}

.log-line.is-warn {
  background: rgba(227, 179, 65, 0.03);
  border-left-color: rgba(227, 179, 65, 0.4);
}

.log-time {
  flex: 0 0 auto;
  color: var(--log-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.log-level {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
  letter-spacing: 0.04em;
  border-radius: 4px;
}

.log-level.is-error {
  color: var(--log-error);
  background: rgba(255, 123, 114, 0.12);
}

.log-level.is-warn {
  color: var(--log-warn);
  background: rgba(227, 179, 65, 0.12);
}

.log-level.is-info {
  color: var(--log-info);
  background: rgba(86, 211, 100, 0.12);
}

.log-level.is-debug {
  color: var(--log-debug);
  background: rgba(121, 192, 255, 0.12);
}

.log-source {
  flex: 0 0 auto;
  color: var(--log-muted);
  white-space: nowrap;
}

.log-message {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--log-text);
  word-break: break-word;
  white-space: pre-wrap;
}

.log-body:not(.is-wrapped) .log-line {
  width: max-content;
  min-width: 100%;
}

.log-body:not(.is-wrapped) .log-message {
  word-break: normal;
  white-space: pre;
}

.log-hit {
  color: #ffe58f;
  background: rgba(255, 213, 79, 0.22);
  border-radius: 2px;
}

.log-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 160px;
  padding: 24px;
  color: var(--log-muted);
  text-align: center;
}

.log-empty-icon {
  width: 34px;
  height: 34px;
  opacity: 0.5;
}

.log-empty-text {
  margin: 0;
  font-size: 13px;
}

.log-empty-action {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--el-color-primary-light-3);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--log-border);
  border-radius: 6px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.log-empty-action:hover {
  color: var(--log-text);
  border-color: var(--el-color-primary-light-3);
}

.log-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  font-size: 11px;
  color: var(--log-muted);
  background: var(--log-bg-elevated);
  border-top: 1px solid var(--log-border);
}

.log-footer-keyword {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Toolbar controls passed in by the logger page and the tunnel log drawer. */
:slotted(.log-switch) .el-switch__label {
  color: var(--log-muted);
}

:slotted(.log-switch) .el-switch__label.is-active {
  color: var(--log-text);
}

/* Element Plus text buttons paint `--el-fill-color-light` on hover/active; the
   extra `is-text` class outranks that rule so the toolbar matches the icon
   buttons next to it. */
:slotted(.el-button.is-text.log-tool) {
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: 0;
  color: var(--log-muted);
  background: transparent;
  border-radius: 6px;

  &:hover:not(.is-disabled),
  &:active:not(.is-disabled) {
    color: var(--log-text);
    background: rgba(255, 255, 255, 0.06);
    border-color: transparent;
  }

  &:focus-visible {
    color: var(--log-text);
    outline: 2px solid var(--el-color-primary-light-3);
    outline-offset: 1px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .log-chip,
  .log-icon-button,
  .log-empty-action {
    transition: none;
  }
}
</style>
