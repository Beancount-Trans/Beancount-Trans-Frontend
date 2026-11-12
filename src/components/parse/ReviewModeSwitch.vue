<template>
  <div class="review-mode-switch">
    <el-radio-group :model-value="mode" size="small" @update:model-value="handleChange">
      <el-radio-button label="simple">表单</el-radio-button>
      <el-radio-button label="advanced">原文</el-radio-button>
    </el-radio-group>
    <el-tooltip placement="top">
      <template #content>
        <div class="review-mode-tooltip">
          <div>表单模式：用表单修改日期、商户、金额、分类与账户。</div>
          <div>原文模式：直接编辑 Beancount 条目。</div>
        </div>
      </template>
      <el-icon class="review-mode-tip"><InfoFilled /></el-icon>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import { useReviewMode, type ReviewMode } from '../../composables/useReviewMode'

const { mode, setMode } = useReviewMode()

const handleChange = (value: string | number | boolean | undefined) => {
  if (value === 'simple' || value === 'advanced') {
    setMode(value as ReviewMode)
  }
}
</script>

<style scoped>
.review-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  user-select: none;
  cursor: default;
}

.review-mode-switch :deep(.el-radio-button__inner) {
  cursor: pointer;
}

.review-mode-tip {
  color: var(--el-text-color-secondary);
  cursor: default;
}

.review-mode-tooltip {
  line-height: 1.6;
  user-select: none;
  cursor: default;
}
</style>
