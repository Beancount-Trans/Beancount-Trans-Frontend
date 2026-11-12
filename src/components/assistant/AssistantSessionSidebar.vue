<template>
  <aside
    class="assistant-sidebar"
    :class="{
      'assistant-sidebar--collapsed': collapsed,
      'assistant-sidebar--overlay': overlay,
    }"
  >
    <div v-if="collapsed" class="sidebar-rail">
      <el-button class="rail-btn" text @click="emit('expand')">
        <el-icon :size="18"><Expand /></el-icon>
      </el-button>
      <el-button class="rail-btn" text @click="emit('new-chat')">
        <el-icon :size="18"><EditPen /></el-icon>
      </el-button>
    </div>

    <div v-else class="assistant-sidebar-inner">
      <div class="sidebar-header">
        <div class="sidebar-header-row">
          <el-button class="collapse-btn" text @click="emit('collapse')">
            <el-icon :size="18"><Fold /></el-icon>
          </el-button>
          <el-button type="primary" class="new-chat-btn" @click="emit('new-chat')">
            新对话
          </el-button>
        </div>
        <el-input
          ref="searchInputRef"
          v-model="searchModel"
          placeholder="搜索会话"
          clearable
          size="small"
          @input="handleSearchInput"
        />
      </div>

      <div
        v-loading="sessionsLoading"
        class="session-list"
        :class="{ 'session-list--empty': sessions.length === 0 && !sessionsLoading }"
      >
        <div v-if="sessions.length === 0 && !sessionsLoading" class="empty-sessions">
          暂无历史会话
        </div>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{
            active: session.id === activeSessionId,
            'is-menu-open': openMenuId === session.id,
          }"
          @click="emit('select', session.id)"
        >
          <div class="session-title" :title="session.title">{{ session.title || '新对话' }}</div>
          <el-dropdown
            trigger="click"
            @command="(command) => handleCommand(command, session)"
            @visible-change="(visible) => onMenuVisible(session.id, visible)"
            @click.stop
          >
            <el-button class="session-more" text size="small" @click.stop>
              <el-icon><More /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <span class="session-delete">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { EditPen, Expand, Fold, More } from '@element-plus/icons-vue'
import type { AssistantSessionSummary } from '../../types/assistant'

const props = defineProps<{
  sessions: AssistantSessionSummary[]
  sessionsLoading: boolean
  searchQuery: string
  activeSessionId?: string
  collapsed?: boolean
  overlay?: boolean
}>()

const emit = defineEmits<{
  'new-chat': []
  select: [sessionId: string]
  rename: [session: AssistantSessionSummary]
  delete: [sessionId: string]
  'update:searchQuery': [value: string]
  search: []
  collapse: []
  expand: []
}>()

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value),
})

const searchInputRef = ref<{ focus: () => void } | null>(null)
const openMenuId = ref<string | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleCommand(command: string, session: AssistantSessionSummary) {
  if (command === 'rename') {
    emit('rename', session)
    return
  }
  if (command === 'delete') {
    emit('delete', session.id)
  }
}

function onMenuVisible(sessionId: string, visible: boolean) {
  openMenuId.value = visible ? sessionId : null
}

function handleSearchInput() {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    emit('search')
  }, 300)
}

function focusSearch() {
  searchInputRef.value?.focus()
}

defineExpose({ focusSearch })
</script>

<style scoped lang="scss">
.assistant-sidebar {
  width: 260px;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  transition: width 0.2s ease;

  &--collapsed {
    width: 52px;
    display: flex;
    flex-direction: column;
  }

  &--overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 30;
    box-shadow: var(--el-box-shadow);
  }
}

.sidebar-rail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 12px 4px 12px 12px;
  box-sizing: border-box;
}

.rail-btn {
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  :deep(span) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }

  :deep(.el-icon) {
    margin: 0;
  }

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.assistant-sidebar-inner {
  width: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar-header {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.sidebar-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  :deep(span) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }

  :deep(.el-icon) {
    margin: 0;
  }
}

.new-chat-btn {
  flex: 1;
  height: 36px;
  margin: 0;
  padding: 0 12px;
}

.session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;

  &--empty {
    overflow: hidden;
  }
}

.empty-sessions {
  padding: 24px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 4px 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background-color 0.15s ease;

  &:hover,
  &.active,
  &.is-menu-open {
    background: var(--el-fill-color-light);
  }

  &.active {
    border: 1px solid var(--el-color-primary-light-5);
  }
}

.session-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-more {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.session-item:hover .session-more,
.session-item.active .session-more,
.session-item.is-menu-open .session-more {
  opacity: 1;
}

.session-delete {
  color: var(--el-color-danger);
}

@media (max-width: 480px) {
  .assistant-sidebar--overlay {
    width: min(86vw, 260px);
  }

  .assistant-sidebar--overlay .assistant-sidebar-inner {
    width: 100%;
  }
}
</style>
