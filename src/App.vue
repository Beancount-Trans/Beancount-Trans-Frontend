<template>
  <el-config-provider :locale="locale">
    <BaseHeader />
    <TaskBanner />
    <div class="flex main-container">
      <div
        class="main-content"
        :class="{ 'main-content--assistant': isAssistantRoute }"
        w="full"
      >
        <CapabilityGate
          v-if="requiredCapability && !can(requiredCapability)"
          :capability="requiredCapability"
        />
        <router-view v-else />
      </div>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import TaskBanner from './components/common/TaskBanner.vue'
import CapabilityGate from './components/common/CapabilityGate.vue'
import { useCapabilities } from './capabilities'
import type { Capability } from './capabilities'

const locale = zhCn
const route = useRoute()
const requiredCapability = computed(() => route.meta.capability as Capability | undefined)
const { can } = useCapabilities()
const gated = computed(() => !!requiredCapability.value && !can(requiredCapability.value))
// 门禁提示页按普通页面布局，避免 Copilot 的全高布局把提示卡拉伸成大框
const isAssistantRoute = computed(() => route.path.startsWith('/assistant') && !gated.value)
</script>

<style>
#app {
  text-align: center;
  color: var(--text-primary);
  background: var(--bg);
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-container {
  flex: 1;
  display: flex;
  min-height: 0;
}

.main-content {
  min-width: 0;
  min-height: 0;
}

.main-content:not(.main-content--assistant) {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.main-content--assistant {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content--assistant > * {
  flex: 1;
  min-height: 0;
}
</style>
