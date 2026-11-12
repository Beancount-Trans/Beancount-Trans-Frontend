<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = withDefaults(
  defineProps<{
    content: string
    /** 表格收缩到容器宽度并换行，用于分享图等不可滚动场景 */
    fitTable?: boolean
  }>(),
  { fitTable: false },
)
const html = computed(() => renderMarkdown(props.content))
</script>

<template>
  <div
    class="markdown-body"
    :class="{ 'markdown-body--fit-table': fitTable }"
    v-html="html"
  />
</template>

<style scoped lang="scss">
.markdown-body {
  word-break: break-word;
  line-height: 1.6;
  color: var(--el-text-color-primary);

  :deep(p) {
    margin: 0 0 0.5em;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 0.75em 0 0.4em;
    font-weight: 600;
    line-height: 1.4;
    color: var(--el-text-color-primary);

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h1) { font-size: 1.25em; }
  :deep(h2) { font-size: 1.15em; }
  :deep(h3) { font-size: 1.05em; }

  :deep(ul),
  :deep(ol) {
    margin: 0.4em 0;
    padding-left: 1.5em;
  }

  :deep(li) {
    margin: 0.2em 0;
  }

  :deep(strong) {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(code) {
    padding: 0.1em 0.35em;
    font-size: 0.9em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: var(--el-fill-color-darker);
    border-radius: 4px;
    color: var(--el-color-primary);
  }

  :deep(pre) {
    margin: 0.5em 0;
    padding: 10px 12px;
    overflow-x: auto;
    font-size: 0.85em;
    line-height: 1.5;
    background: var(--el-fill-color-darker);
    border-radius: 6px;

    code {
      padding: 0;
      background: transparent;
      color: var(--el-text-color-regular);
    }
  }

  :deep(blockquote) {
    margin: 0.5em 0;
    padding-left: 12px;
    border-left: 3px solid var(--el-border-color);
    color: var(--el-text-color-secondary);
  }

  :deep(hr) {
    margin: 0.75em 0;
    border: none;
    border-top: 1px solid var(--el-border-color-light);
  }

  :deep(a) {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(table) {
    width: 100%;
    margin: 0.5em 0;
    border-collapse: collapse;
    font-size: 0.9em;
    display: block;
    overflow-x: auto;
  }

  :deep(th),
  :deep(td) {
    padding: 6px 10px;
    border: 1px solid var(--el-border-color-light);
    text-align: left;
    white-space: nowrap;
  }

  :deep(th) {
    font-weight: 600;
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
  }

  :deep(tr:nth-child(even) td) {
    background: var(--el-fill-color-lighter);
  }

  // 分享图等不可滚动场景：表格收缩到容器宽度，单元格内容换行，避免右侧被裁掉。
  &.markdown-body--fit-table {
    :deep(table) {
      display: table;
      table-layout: fixed;
      overflow: visible;
    }

    :deep(th),
    :deep(td) {
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
  }
}
</style>
