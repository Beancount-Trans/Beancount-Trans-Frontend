/**
 * 审核页展示模式：表单模式 / 原文模式（Beancount 原文编辑）。
 *
 * 模块级 ref 让审核页与解析首页共享同一模式；localStorage 持久化用户选择。
 */

import { ref } from 'vue'

export type ReviewMode = 'simple' | 'advanced'

const STORAGE_KEY = 'bct_review_mode'

function readStoredMode(): ReviewMode {
  if (typeof window === 'undefined') return 'simple'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'advanced' ? 'advanced' : 'simple'
  } catch {
    return 'simple'
  }
}

const mode = ref<ReviewMode>(readStoredMode())

export function useReviewMode() {
  const setMode = (next: ReviewMode) => {
    mode.value = next
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage 不可用时只保留内存状态
    }
  }

  return { mode, setMode }
}
