<script setup lang="ts">
import { computed } from 'vue'
import type { AssistantShareTurn } from '../../types/assistant'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  turns: AssistantShareTurn[]
}>()

const shareDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const showTurnNumber = computed(() => props.turns.length > 1)
</script>

<template>
  <div class="assistant-share-card">
    <div class="share-card__header">Beancount-Trans</div>

    <template v-for="(turn, index) in turns" :key="index">
      <div v-if="index > 0" class="share-card__divider" />

      <div class="share-card__turn">
        <div v-if="showTurnNumber" class="share-card__turn-title">对话 {{ index + 1 }}</div>

        <div class="share-card__section">
          <div class="share-card__label">你的问题</div>
          <div class="share-card__user-text">{{ turn.userMessage }}</div>
        </div>

        <div class="share-card__section">
          <div class="share-card__label">Copilot</div>
          <MarkdownContent :content="turn.assistantContent" fit-table class="share-card__markdown" />
        </div>
      </div>
    </template>

    <div class="share-card__footer">
      <p class="share-card__notice">
        隐私提示：本图可能包含个人账本信息，请勿随意分享给陌生人。
      </p>
      <p class="share-card__notice">
        以上内容由 AI 生成，仅供参考，请注意甄别。
      </p>
      <p class="share-card__date">{{ shareDate }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.assistant-share-card {
  width: 640px;
  padding: 24px;
  background: var(--share-bg);
  color: var(--share-text);
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
}

.share-card__header {
  font-size: 18px;
  font-weight: 700;
  color: var(--share-text);
  margin-bottom: 20px;
  padding-bottom: 12px;
  padding-left: 12px;
  border-bottom: 1px solid var(--share-border);
  border-left: 4px solid var(--share-accent);
}

.share-card__divider {
  margin: 20px 0;
  border-top: 1px dashed var(--share-border);
}

.share-card__turn-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--share-text-secondary);
  margin-bottom: 12px;
}

.share-card__section {
  margin-bottom: 16px;
}

.share-card__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--share-text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.share-card__user-text {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--share-text);
}

.share-card__markdown {
  font-size: 14px;
  color: var(--share-text);

  :deep(.markdown-body) {
    color: var(--share-text);
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    color: var(--share-text);
  }

  :deep(p),
  :deep(li) {
    color: var(--share-text);
  }

  :deep(strong) {
    color: var(--share-text);
  }

  :deep(blockquote) {
    color: var(--share-text-secondary);
    border-left-color: var(--share-border);
  }

  :deep(hr) {
    border-top-color: var(--share-border);
  }

  :deep(code) {
    background: var(--share-surface);
    color: var(--share-accent);
  }

  :deep(pre) {
    background: var(--share-surface);
    overflow-x: auto;

    code {
      color: var(--share-text-secondary);
    }
  }

  :deep(th) {
    background: var(--share-surface);
    color: var(--share-text);
  }

  :deep(td),
  :deep(th) {
    border-color: var(--share-border);
    color: var(--share-text);
  }

  :deep(tr:nth-child(even) td) {
    background: var(--share-surface);
  }

  :deep(a) {
    color: var(--share-accent);
  }
}

.share-card__footer {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--share-border);
}

.share-card__notice {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--share-text-tertiary);
}

.share-card__date {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--share-text-tertiary);
  text-align: right;
}
</style>
