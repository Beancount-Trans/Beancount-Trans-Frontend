/**
 * 审核页展示模式：表单模式 / 原文模式（Beancount 原文编辑）。
 *
 * 模块级 ref 让审核页与解析首页共享同一模式；localStorage 持久化用户选择。
 */

import { ref } from 'vue'
import { getSessionTier } from '../capabilities/store'

export type ReviewMode = 'simple' | 'advanced'

const STORAGE_KEY = 'bct_review_mode'

/** 无本地选择时：游客首次解析直接看原文，登录用户默认表单 */
function defaultMode(): ReviewMode {
  return getSessionTier() === 'guest' ? 'advanced' : 'simple'
}

function readStoredMode(): ReviewMode {
  if (typeof window === 'undefined') return 'simple'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'simple' || stored === 'advanced') return stored
  } catch {
    // localStorage 不可用时使用默认值
  }
  return defaultMode()
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
