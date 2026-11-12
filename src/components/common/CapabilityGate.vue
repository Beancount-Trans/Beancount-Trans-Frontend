<template>
  <div v-if="!allowed" class="capability-gate">
    <div class="capability-gate__inner">
      <el-icon class="capability-gate__icon" :size="32">
        <Lock />
      </el-icon>
      <h2 class="capability-gate__title">{{ resolved.title }}</h2>
      <p class="capability-gate__description">{{ resolved.description }}</p>
      <div class="capability-gate__actions">
        <el-button type="primary" @click="handlePrimary">{{ resolved.actionText }}</el-button>
        <el-button text @click="goParse">返回账单解析</el-button>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock } from '@element-plus/icons-vue'
import { useCapabilities } from '../../capabilities'
import type { Capability } from '../../capabilities'
import { setLoginRedirect } from '../../utils/auth'

const props = defineProps<{
  capability: Capability
  title?: string
  description?: string
  actionText?: string
  to?: string
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

function handlePrimary() {
  if (resolved.value.to) {
    router.push(resolved.value.to)
    return
  }
  setLoginRedirect(route.fullPath)
  router.push('/login')
}

function goParse() {
  router.push('/trans')
}
</script>

<style scoped>
.capability-gate {
  display: flex;
  justify-content: center;
  padding: 48px 20px;
}

.capability-gate__inner {
  width: min(520px, 100%);
  padding: 40px 32px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: center;
}

.capability-gate__icon {
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.capability-gate__title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.capability-gate__description {
  margin: 0 0 24px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.capability-gate__actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
