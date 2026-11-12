<script setup lang="ts">
import { computed } from 'vue'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  thinking: string
  streaming?: boolean
}>()

const expanded = defineModel<boolean>('expanded', { default: false })

const collapseNames = computed(() => (expanded.value ? ['thinking'] : []))

const title = computed(() => {
  if (props.streaming) {
    return '思考中...'
  }
  return '已深度思考'
})

function onCollapseChange(names: string | string[]) {
  const list = Array.isArray(names) ? names : [names]
  expanded.value = list.includes('thinking')
}
</script>

<template>
  <el-collapse
    class="thinking-collapse"
    :model-value="collapseNames"
    @change="onCollapseChange"
  >
    <el-collapse-item :title="title" name="thinking">
      <div v-if="streaming" class="thinking-stream">
        <span class="thinking-stream-text">{{ thinking }}</span>
        <span class="thinking-cursor">▍</span>
      </div>
      <MarkdownContent
        v-else
        :content="thinking"
        class="thinking-markdown"
      />
    </el-collapse-item>
  </el-collapse>
</template>

<style scoped lang="scss">
.thinking-collapse {
  margin-bottom: 8px;
  border: none;

  :deep(.el-collapse-item__header) {
    height: auto;
    min-height: 32px;
    padding: 4px 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    background: transparent;
    border: none;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background: transparent;
  }

  :deep(.el-collapse-item__content) {
    padding: 0 0 8px 12px;
    border-left: 2px solid var(--el-border-color-lighter);
  }
}

.thinking-stream {
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.thinking-cursor {
  animation: thinking-blink 1s step-end infinite;
}

@keyframes thinking-blink {
  50% {
    opacity: 0;
  }
}

.thinking-markdown {
  font-size: 13px;
  color: var(--el-text-color-secondary);

  :deep(.markdown-body) {
    color: var(--el-text-color-secondary);
  }
}
</style>
