<template>
  <div v-if="!allowed" class="capability-notice" :class="{ 'capability-notice--dense': dense }">
    <div class="capability-notice__text">
      <strong class="capability-notice__title">{{ resolved.title }}</strong>
      <span class="capability-notice__description">{{ resolved.description }}</span>
    </div>
    <el-button type="primary" size="small" @click="handlePrimary">{{ resolved.actionText }}</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCapabilities } from '../../capabilities'
import type { Capability } from '../../capabilities'
import { setLoginRedirect } from '../../utils/auth'

const props = defineProps<{
  capability: Capability
  title?: string
  description?: string
  actionText?: string
  to?: string
  dense?: boolean
  /** 跳转前执行，用于暂存草稿等 */
  beforeAction?: () => void | Promise<void>
}>()

const route = useRoute()
const router = useRouter()
const { can, reason } = useCapabilities()

const allowed = computed(() => can(props.capability))
const resolved = computed(() => {
  const fallback = reason(props.capability)
  return {
    title: props.title || fallback.title,
    description: props.description || fallback.description,
    actionText: props.actionText || fallback.actionText,
    to: props.to || fallback.to,
  }
})

async function handlePrimary() {
  await props.beforeAction?.()
  if (resolved.value.to) {
    router.push(resolved.value.to)
    return
  }
  setLoginRedirect(route.fullPath)
  router.push('/login')
}
</script>

<style scoped>
.capability-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--status-neutral);
  color: var(--on-status-neutral);
}

.capability-notice--dense {
  padding: 8px 12px;
}

.capability-notice__text {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.capability-notice__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.capability-notice__description {
  font-size: 13px;
  line-height: 1.5;
}
</style>
