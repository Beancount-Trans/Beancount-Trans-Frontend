<script setup lang="ts">
import { computed } from 'vue'
import type { AssistantShareTurn } from '../../types/assistant'
import MarkdownContent from './MarkdownContent.vue'

defineProps<{
  turns: AssistantShareTurn[]
}>()

const shareDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})
</script>

<template>
  <div class="assistant-share-card">
    <div class="share-card__header">
      <svg class="share-card__logo" viewBox="0 0 1024 1024" role="img" aria-label="财见">
        <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="40">
          <path d="M 103,163 L 568,515 Q 589,531 609,515 L 906,281 Q 928,264 908,245 L 802,163" stroke="#14181A" />
          <path d="M 104,322 L 568,674 Q 590,691 611,674 L 906,440 Q 927,423 907,404 L 853,361" stroke="#14181A" />
          <path d="M 104,481 L 568,833 Q 590,850 611,833 L 906,599 Q 928,582 907,563 L 853,520" stroke="#1B5079" />
        </g>
      </svg>
      <span class="share-card__brand">财见</span>
    </div>

    <div v-for="(turn, index) in turns" :key="index" class="share-card__turn">
      <div class="share-card__user-row">
        <div class="share-card__bubble">{{ turn.userMessage }}</div>
      </div>
      <MarkdownContent :content="turn.assistantContent" fit-table class="share-card__markdown" />
    </div>

    <div class="share-card__footer">
      <p class="share-card__notice">
        隐私提示：本图可能包含个人账本信息，请勿随意分享。
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
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
}

.share-card__logo {
  width: 32px;
  height: 32px;
  flex: none;
}

.share-card__brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--share-text);
}

.share-card__turn+.share-card__turn {
  margin-top: 24px;
}

.share-card__user-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.share-card__bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--share-surface);
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
  margin-top: 24px;
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
