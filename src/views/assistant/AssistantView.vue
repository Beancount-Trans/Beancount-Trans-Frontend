<template>
  <div class="assistant-layout">
    <div v-if="sidebarOverlay" class="sidebar-scrim" @click="sidebarOpen = false" />
    <AssistantSessionSidebar ref="sessionSidebarRef" :sessions="sessions" :sessions-loading="sessionsLoading"
      v-model:search-query="searchQuery" :active-session-id="activeSessionId" :collapsed="!sidebarOpen"
      :overlay="sidebarOverlay" @new-chat="handleNewChat" @select="handleSelectSession" @rename="handleRenameSession"
      @delete="handleDeleteSession" @search="fetchSessions" @collapse="sidebarOpen = false"
      @expand="sidebarOpen = true" />

    <div class="assistant-page" :class="{ 'assistant-page--share-select': shareSelectMode }">
      <el-alert v-if="!statusLoading && status && !status.api_key_configured" type="warning" :closable="false" show-icon
        class="setup-alert" title="尚未配置 Copilot">
        <template #default>
          请在
          <router-link to="/format" class="alert-link">输出配置</router-link>
          的「Copilot」中填写接口地址、模型与密钥。
        </template>
      </el-alert>

      <el-alert v-if="!statusLoading && status && !status.ledger_exists && !status.has_usable_shared_ledger" type="info"
        :closable="false" show-icon class="setup-alert" title="账本尚未就绪">
        <template #default>
          请先在
          <router-link to="/file" class="alert-link">文件管理</router-link>
          上传并解析账单生成自己的账本，或到
          <router-link to="/settings" class="alert-link">个人设置 → 共享账本</router-link>
          绑定他人共享的账本后再使用 Copilot。
        </template>
      </el-alert>

      <el-alert v-if="error && !loading" type="error" :closable="false" show-icon class="setup-alert" :title="error">
        <template #default>
          <el-button size="small" @click="fetchStatus">重试连接</el-button>
        </template>
      </el-alert>

      <div class="chat-container" ref="chatContainerRef" :class="{ 'chat-container--welcome': messages.length === 0 }"
        v-loading="sessionLoading" @scroll.passive="handleChatScroll">
        <div v-if="messages.length === 0" class="welcome-panel">
          <svg class="welcome-logo" viewBox="0 0 1024 1024" role="img" aria-label="财见">
            <g fill="none" stroke-width="23" stroke-linecap="round" stroke-linejoin="round">
              <path stroke="currentColor"
                d="M 103,163 L 568,515 Q 589,531 609,515 L 906,281 Q 928,264 908,245 L 802,163" />
              <path stroke="currentColor"
                d="M 104,322 L 568,674 Q 590,691 611,674 L 906,440 Q 927,423 907,404 L 853,361" />
              <path stroke="var(--action)"
                d="M 104,481 L 568,833 Q 590,850 611,833 L 906,599 Q 928,582 907,563 L 853,520" />
            </g>
          </svg>
          <!-- <p class="welcome-text">欢迎回来</p> -->
          <p class="welcome-readonly">Copilot 只读查询账本，不会改账。</p>
          <Transition name="example-chip" mode="out-in">
            <div class="example-chips" :key="examplePage">
              <el-button v-for="q in visibleExampleQuestions" :key="q" size="small" round
                :disabled="!canChat || loading" @click="handleExample(q)">
                {{ q }}
              </el-button>
            </div>
          </Transition>
        </div>

        <div v-for="(msg, index) in messages" :key="index" class="message-row" :class="{
          [msg.role]: true,
          'share-selectable': shareSelectMode && canShareAssistantMessage(msg),
          'is-selected': shareSelectMode && selectedIndices.has(index),
        }" @click="handleShareRowClick(index, msg)">
          <el-checkbox v-if="shareSelectMode && canShareAssistantMessage(msg)" class="share-checkbox"
            :model-value="selectedIndices.has(index)" :disabled="sharing" @click.stop
            @change="(val: CheckboxValueType) => toggleShareSelection(index, val === true)" />
          <div class="message-bubble">
            <div v-if="msg.role === 'assistant'" class="message-role">Copilot</div>
            <div v-if="msg.role === 'user'" class="user-message">
              <template v-if="editingIndex === index">
                <el-input v-model="editDraft" type="textarea" :autosize="{ minRows: 2, maxRows: 8 }" :disabled="loading"
                  @click.stop @keydown.enter.exact.prevent="confirmEdit" @keydown.esc="cancelEdit" />
                <div class="user-edit-actions" @click.stop>
                  <el-button size="small" :disabled="loading" @click="cancelEdit">取消</el-button>
                  <el-button size="small" type="primary" :disabled="loading || !editDraft.trim()" @click="confirmEdit">
                    重新发送
                  </el-button>
                </div>
              </template>
              <template v-else>
                <div class="message-content message-content--user">{{ msg.content }}</div>
                <div v-if="!loading && !shareSelectMode && msg.id" class="user-message-actions" @click.stop>
                  <el-button size="small" text @click="startEdit(index)">
                    <el-icon>
                      <EditPen />
                    </el-icon>
                    编辑
                  </el-button>
                </div>
              </template>
            </div>
            <template v-else>
              <AssistantThinkingBlock v-if="msg.thinking?.trim()" v-model:expanded="msg.thinkingExpanded"
                :thinking="msg.thinking" :streaming="!!msg.streaming && !msg.content" @click.stop />
              <div v-if="msg.streaming && (msg.content || !msg.thinking?.trim())"
                class="message-content message-content--assistant message-content--streaming">
                <template v-if="!msg.content">
                  <span class="status-hint">{{ statusHint(msg.status) }}</span>
                </template>
                <template v-else>
                  <span class="streaming-text">{{ msg.content }}</span>
                  <span class="streaming-cursor">▍</span>
                </template>
              </div>
              <MarkdownContent v-else-if="!isInterruptedAssistant(msg)" :content="msg.content"
                class="message-content message-content--assistant" />
              <div v-if="msg.role === 'assistant' && !msg.streaming && msg.content && !isInterruptedAssistant(msg)"
                class="feedback-bar" @click.stop>
                <el-button size="small" text class="feedback-btn" title="复制 Markdown" aria-label="复制 Markdown"
                  @click="handleCopyMarkdown(index)">
                  <el-icon>
                    <DocumentCopy />
                  </el-icon>
                </el-button>
                <el-button v-if="!shareSelectMode" size="small" text class="feedback-btn" title="重新生成" aria-label="重新生成"
                  :disabled="loading || sharing" @click="handleRegenerate(index)">
                  <el-icon>
                    <Refresh />
                  </el-icon>
                </el-button>
                <el-button v-if="!shareSelectMode" size="small" text class="feedback-btn" title="分享" aria-label="分享"
                  :disabled="sharing" @click="handleShareClick(index)">
                  <el-icon>
                    <Share />
                  </el-icon>
                </el-button>
                <span class="feedback-divider" />
                <el-button size="small" text class="feedback-btn" title="喜欢" aria-label="喜欢"
                  :type="msg.feedback === 'like' ? 'primary' : 'default'" :loading="msg.feedbackSubmitting"
                  :disabled="msg.feedbackSubmitting || sharing" @click="handleLike(index)">
                  <el-icon>
                    <CircleCheck />
                  </el-icon>
                </el-button>
                <el-button size="small" text class="feedback-btn" title="不喜欢" aria-label="不喜欢"
                  :type="msg.feedback === 'dislike' ? 'danger' : 'default'" :loading="msg.feedbackSubmitting"
                  :disabled="msg.feedbackSubmitting || sharing" @click="handleDislike(index)">
                  <el-icon>
                    <CircleClose />
                  </el-icon>
                </el-button>
              </div>
              <div v-if="isInterruptedAssistant(msg) && !shareSelectMode" class="interrupted-bar" @click.stop>
                <span>生成已中断</span>
                <el-button size="small" :disabled="loading" @click="handleRetryInterrupted(index)">
                  重新生成
                </el-button>
              </div>
              <div v-if="msg.role === 'assistant' && !msg.streaming && hasQuerySources(msg)" class="query-sources"
                @click.stop>
                <div class="query-sources-title">来源</div>
                <div v-for="(q, qi) in msg.queries" :key="`source-${qi}`" class="query-source-group">
                  <span v-if="sharedLedgerLabel(q)" class="query-source-ledger">来源：{{ sharedLedgerLabel(q) }}</span>
                  <template v-if="q.fava_path || q.report?.path">
                    <el-button v-if="q.fava_path" size="small" text type="primary"
                      :loading="openingFavaPath === q.fava_path" @click="handleOpenFavaPath(q.fava_path)">
                      打开本次查询{{ msg.queries!.length > 1 ? ` (${qi + 1})` : '' }}
                    </el-button>
                    <el-button v-if="q.report?.path" size="small" text type="primary"
                      :loading="openingFavaPath === q.report.path" @click="handleOpenFavaPath(q.report.path)">
                      打开{{ q.report.label }}
                    </el-button>
                  </template>
                </div>
              </div>
            </template>
            <el-collapse v-if="msg.role === 'assistant' && msg.queries?.length" class="query-collapse" @click.stop>
              <el-collapse-item title="查看查询详情" name="queries">
                <div v-for="(q, qi) in msg.queries" :key="qi" class="query-block">
                  <pre class="query-bql">{{ q.bql }}</pre>
                  <pre class="query-result">{{ q.result_preview }}</pre>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </div>
      </div>

      <div v-if="!shareSelectMode" class="input-area">
        <div class="composer">
          <el-input ref="composerInputRef" v-model="inputText" type="textarea" :autosize="{ minRows: 1, maxRows: 8 }"
            placeholder="给财见 Copilot 发送消息" :disabled="!canChat || loading" resize="none"
            @keydown.enter.exact.prevent="handleSend" />
          <div class="composer-footer">
            <span class="composer-meta">{{ modelLabel }}</span>
            <div class="input-actions">
              <el-switch v-model="deepThink" inline-prompt active-text="DeepThink" inactive-text="DeepThink"
                :disabled="!canChat || loading || !deepThinkSupported" />
              <el-button v-if="loading" @click="stop">
                停止
              </el-button>
              <el-button v-else type="primary" :disabled="!canChat || !inputText.trim()" @click="handleSend">
                发送
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="shareSelectMode" class="share-select-bar">
        <span class="share-select-count">已选 {{ selectedIndices.size }} 条对话</span>
        <el-button :disabled="sharing" @click="exitShareSelectMode">取消</el-button>
        <el-button type="primary" :loading="sharing" :disabled="selectedIndices.size === 0"
          @click="handleGenerateShareImage">
          生成分享图
        </el-button>
      </div>

      <Teleport to="body">
        <div v-if="sharePreview" ref="shareCardHostRef" class="share-card-host">
          <AssistantShareCard :turns="sharePreview.turns" />
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CheckboxValueType, InputInstance } from 'element-plus'
import { CircleCheck, CircleClose, DocumentCopy, EditPen, Refresh, Share } from '@element-plus/icons-vue'
import AssistantSessionSidebar from '../../components/assistant/AssistantSessionSidebar.vue'
import AssistantShareCard from '../../components/assistant/AssistantShareCard.vue'
import AssistantThinkingBlock from '../../components/assistant/AssistantThinkingBlock.vue'
import MarkdownContent from '../../components/assistant/MarkdownContent.vue'
import { useAssistantChat } from '../../composables/useAssistantChat'
import { useAssistantSessions } from '../../composables/useAssistantSessions'
import { ensureFavaThenOpen } from '../../composables/useFavaDeepLink'
import { listSharedLedgers } from '../../api/assistant'
import { copyText } from '../../utils/clipboard'
import {
  buildShareTurns,
  canShareAssistantMessage,
  MAX_SHARE_TURNS,
  validateShareTurnCount,
} from '../../utils/assistantShare'
import { captureElementAsPng, sharePngBlob } from '../../utils/shareImage'
import type { AssistantPhase, AssistantSessionSummary, AssistantShareTurn, ChatMessage, QueryRecord, SharedLedgerBinding } from '../../types/assistant'

const route = useRoute()
const router = useRouter()

const sessionId = computed(() => {
  const value = route.params.sessionId
  return typeof value === 'string' && value ? value : undefined
})

const {
  sessions,
  sessionsLoading,
  searchQuery,
  fetchSessions,
  renameSession,
  removeSession,
} = useAssistantSessions()

const {
  messages,
  loading,
  sessionLoading,
  activeSessionId,
  deepThink,
  status,
  statusLoading,
  error,
  canChat,
  deepThinkSupported,
  exampleQuestions,
  fetchStatus,
  send,
  stop,
  abortSubscription,
  submitFeedback,
  startNewChat,
  isInterruptedAssistant,
  retryFromAssistant,
} = useAssistantChat({
  sessionId,
  router,
  onSessionsChanged: fetchSessions,
})

const SIDEBAR_OPEN_KEY = 'assistant-sidebar-open'
const SIDEBAR_QUERY = '(max-width: 1024px)'
const sidebarMedia = window.matchMedia(SIDEBAR_QUERY)
const isNarrow = ref(sidebarMedia.matches)
const sidebarOpen = ref(
  isNarrow.value ? false : localStorage.getItem(SIDEBAR_OPEN_KEY) !== '0',
)
const sidebarOverlay = computed(() => isNarrow.value && sidebarOpen.value)

function handleSidebarMediaChange(event: MediaQueryListEvent) {
  isNarrow.value = event.matches
  sidebarOpen.value = event.matches
    ? false
    : localStorage.getItem(SIDEBAR_OPEN_KEY) !== '0'
}

watch(sidebarOpen, (open) => {
  if (!isNarrow.value) {
    localStorage.setItem(SIDEBAR_OPEN_KEY, open ? '1' : '0')
  }
})

const sessionSidebarRef = ref<{ focusSearch: () => void } | null>(null)
const composerInputRef = ref<InputInstance>()
const inputText = ref('')
const chatContainerRef = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)
const editingIndex = ref<number | null>(null)
const editDraft = ref('')
const openingFavaPath = ref<string | null>(null)
const STICK_THRESHOLD_PX = 80

const modelLabel = computed(() => status.value?.assistant_model?.trim() || '')

/** 首页示例问句一次展示的条数（与移动端一致）。 */
const EXAMPLE_WINDOW = 4
/** 首页示例问句当前展示的分组下标（点击示例或开启新会话时前进一组）。 */
const examplePage = ref(0)
const examplePageCount = computed(() => Math.ceil(exampleQuestions.length / EXAMPLE_WINDOW))
const visibleExampleQuestions = computed(() => {
  const start = examplePage.value * EXAMPLE_WINDOW
  return exampleQuestions.slice(start, start + EXAMPLE_WINDOW)
})

/** 首页示例问句前进一组（重新回到欢迎区时才可见）。 */
function advanceExamplePage() {
  if (examplePageCount.value <= 1) {
    return
  }
  examplePage.value = (examplePage.value + 1) % examplePageCount.value
}

function statusHint(phase?: AssistantPhase): string {
  if (phase === 'querying') return '正在查询账本...'
  if (phase === 'writing') return '正在撰写回答...'
  return '正在思考...'
}

const sharedLedgers = ref<SharedLedgerBinding[]>([])

/** 将查询记录中的 ledger 解析为共享账本的展示名称（self 或未设置时返回空字符串）。 */
function sharedLedgerLabel(query: QueryRecord): string {
  if (!query.ledger || query.ledger === 'self') {
    return ''
  }
  // query.ledger 为共享账本的某个别名；无别名时为来源用户名，命中别名时附带来源用户名便于区分
  const binding = sharedLedgers.value.find(
    (item) => item.aliases?.includes(query.ledger!) || item.owner_username === query.ledger,
  )
  if (binding && query.ledger !== binding.owner_username) {
    return `${query.ledger}（${binding.owner_username}）`
  }
  return query.ledger
}

async function fetchSharedLedgers() {
  try {
    const { data } = await listSharedLedgers()
    sharedLedgers.value = data
  } catch {
    sharedLedgers.value = []
  }
}

function hasQuerySources(message: ChatMessage): boolean {
  return Boolean(
    message.queries?.some(
      (query) => query.fava_path || query.report?.path || sharedLedgerLabel(query),
    ),
  )
}

async function handleOpenFavaPath(relativePath: string) {
  if (!relativePath || openingFavaPath.value) {
    return
  }
  openingFavaPath.value = relativePath
  try {
    const opened = await ensureFavaThenOpen(relativePath)
    if (opened) {
      ElMessage.success('已在新标签打开 Fava')
    } else {
      ElMessage.error('打开 Fava 失败，请检查登录状态或允许弹出窗口')
    }
  } catch {
    ElMessage.error('打开 Fava 失败')
  } finally {
    openingFavaPath.value = null
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function focusComposer() {
  composerInputRef.value?.focus()
}

function handleShortcut(event: KeyboardEvent) {
  const meta = event.ctrlKey || event.metaKey
  if (meta && event.key.toLowerCase() === 'n') {
    event.preventDefault()
    handleNewChat()
    return
  }
  if (meta && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    sidebarOpen.value = true
    nextTick(() => {
      sessionSidebarRef.value?.focusSearch()
    })
    return
  }
  if (event.key === '/' && !meta && !event.altKey && !isTypingTarget(event.target)) {
    event.preventDefault()
    focusComposer()
  }
}

async function handleCopyMarkdown(index: number) {
  const message = messages.value[index]
  if (!message?.content) {
    return
  }
  try {
    await copyText(message.content)
    ElMessage.success('已复制 Markdown')
  } catch {
    ElMessage.error('复制失败')
  }
}

const shareSelectMode = ref(false)
const selectedIndices = ref<Set<number>>(new Set())
const sharing = ref(false)
const sharePreview = ref<{ turns: AssistantShareTurn[] } | null>(null)
const shareCardHostRef = ref<HTMLElement | null>(null)

function exitShareSelectMode() {
  shareSelectMode.value = false
  selectedIndices.value = new Set()
}

function handleShareClick(index: number) {
  if (sharing.value || !canShareAssistantMessage(messages.value[index])) {
    return
  }
  shareSelectMode.value = true
  selectedIndices.value = new Set([index])
}

function toggleShareSelection(index: number, checked: boolean) {
  if (sharing.value) {
    return
  }

  const next = new Set(selectedIndices.value)
  if (checked) {
    if (next.size >= MAX_SHARE_TURNS) {
      ElMessage.warning(`最多选择 ${MAX_SHARE_TURNS} 条对话`)
      return
    }
    next.add(index)
  } else {
    next.delete(index)
  }
  selectedIndices.value = next
}

function handleShareRowClick(index: number, msg: ChatMessage) {
  if (!shareSelectMode.value || !canShareAssistantMessage(msg) || sharing.value) {
    return
  }
  toggleShareSelection(index, !selectedIndices.value.has(index))
}

async function renderAndShare(turns: AssistantShareTurn[]) {
  if (!validateShareTurnCount(turns.length)) {
    return
  }

  sharing.value = true
  sharePreview.value = { turns }

  try {
    await nextTick()
    const card = shareCardHostRef.value?.firstElementChild as HTMLElement | null
    if (!card) {
      throw new Error('分享卡片渲染失败')
    }
    const blob = await captureElementAsPng(card)
    const timestamp = new Date().toISOString().slice(0, 10)
    await sharePngBlob(blob, `assistant-${turns.length}turns-${timestamp}.png`)
    ElMessage.success('分享图片已生成')
    exitShareSelectMode()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    ElMessage.error(error instanceof Error ? error.message : '生成分享图片失败')
  } finally {
    sharing.value = false
    sharePreview.value = null
  }
}

async function handleGenerateShareImage() {
  const indices = [...selectedIndices.value]
  const turns = buildShareTurns(messages.value, indices)
  await renderAndShare(turns)
}

function handleNewChat() {
  cancelEdit()
  exitShareSelectMode()
  // 开启新会话时换一组示例问句
  advanceExamplePage()
  if (isNarrow.value) {
    sidebarOpen.value = false
  }
  startNewChat()
}

function handleSelectSession(id: string) {
  if (id === activeSessionId.value) {
    return
  }
  cancelEdit()
  exitShareSelectMode()
  stickToBottom.value = true
  if (isNarrow.value) {
    sidebarOpen.value = false
  }
  // 立即切换当前会话，避免路由参数延迟更新时把消息发到上一个会话
  activeSessionId.value = id
  router.push(`/assistant/${id}`)
}

async function handleRenameSession(session: AssistantSessionSummary) {
  try {
    const { value } = await ElMessageBox.prompt('输入新的会话标题', '重命名', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: session.title,
      inputValidator: (value: string) => !!value?.trim() || '标题不能为空',
    })
    if (!value?.trim()) {
      return
    }
    await renameSession(session.id, value.trim())
  } catch {
    // 用户取消
  }
}

async function handleDeleteSession(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该会话吗？此操作不可恢复。', '删除会话', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await removeSession(id)
    if (activeSessionId.value === id) {
      startNewChat()
    }
  } catch {
    // 用户取消
  }
}

async function handleLike(index: number) {
  await submitFeedback(index, 'like')
}

async function handleDislike(index: number) {
  const message = messages.value[index]
  if (!message || message.role !== 'assistant') {
    return
  }

  if (message.feedback === 'dislike') {
    await submitFeedback(index, 'dislike')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt(
      '可以告诉我们哪里不满意（可选）',
      '反馈原因',
      {
        confirmButtonText: '提交',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '例如：数据不准确、回答不完整...',
        inputValidator: (value: string) => !value || value.length <= 500 || '原因不超过 500 字',
      },
    )
    await submitFeedback(index, 'dislike', value?.trim() || '')
  } catch {
    // 用户取消弹窗
  }
}

async function handleSend() {
  const text = inputText.value
  if (!text.trim()) return
  if (loading.value) return
  cancelEdit()
  inputText.value = ''
  stickToBottom.value = true
  const sent = await send(text)
  if (!sent) {
    inputText.value = text
    return
  }
  await scrollToBottom()
}

async function handleExample(question: string) {
  cancelEdit()
  stickToBottom.value = true
  // 点击示例问句：换一组并直接发送
  advanceExamplePage()
  await send(question)
  await scrollToBottom()
}

function startEdit(index: number) {
  const message = messages.value[index]
  if (!message || message.role !== 'user' || !message.id || loading.value) {
    return
  }
  editingIndex.value = index
  editDraft.value = message.content
}

function cancelEdit() {
  editingIndex.value = null
  editDraft.value = ''
}

async function confirmEdit() {
  if (editingIndex.value === null) {
    return
  }
  const message = messages.value[editingIndex.value]
  const text = editDraft.value.trim()
  if (!message?.id || !text || loading.value) {
    return
  }
  const editMessageId = message.id
  cancelEdit()
  stickToBottom.value = true
  await send(text, { editMessageId })
  await scrollToBottom()
}

async function handleRegenerate(index: number) {
  if (loading.value) return
  stickToBottom.value = true
  await retryFromAssistant(index)
  await scrollToBottom()
}

async function handleRetryInterrupted(index: number) {
  stickToBottom.value = true
  await retryFromAssistant(index)
  await scrollToBottom()
}

function handleChatScroll() {
  const el = chatContainerRef.value
  if (!el) {
    return
  }
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom.value = gap <= STICK_THRESHOLD_PX
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    stickToBottom.value = true
  }
}

watch(messages, () => {
  if (stickToBottom.value) {
    scrollToBottom()
  }
}, { deep: true })

watch(activeSessionId, () => {
  cancelEdit()
})

watch(deepThinkSupported, (supported) => {
  if (!supported) {
    deepThink.value = false
  }
})

onMounted(() => {
  fetchStatus()
  fetchSessions()
  fetchSharedLedgers()
  window.addEventListener('keydown', handleShortcut)
  sidebarMedia.addEventListener('change', handleSidebarMediaChange)
})

onUnmounted(() => {
  abortSubscription()
  window.removeEventListener('keydown', handleShortcut)
  sidebarMedia.removeEventListener('change', handleSidebarMediaChange)
})
</script>

<style scoped lang="scss">
.assistant-layout {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  text-align: left;
}

.assistant-page {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);

  &--share-select {
    padding-bottom: 88px;
  }
}

.setup-alert {
  align-self: center;
  width: min(800px, calc(100% - 48px));
  margin: 12px auto 0;
  flex-shrink: 0;
  box-sizing: border-box;
}

.sidebar-scrim {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--el-overlay-color-lighter);
}

.welcome-text {
  margin: 16px 0 8px;
  color: var(--el-text-color-regular);
}

.welcome-readonly {
  margin: 0 0 24px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.alert-link {
  color: var(--el-color-primary);
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--surface);
  min-height: 0;

  &--welcome {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
}

.welcome-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 800px;
  margin: auto;
  padding: 32px 16px;
  text-align: center;
}

.welcome-logo {
  width: 72px;
  height: 72px;
  color: var(--text-primary);
}

.example-chips {
  width: 100%;
  max-width: 560px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }
}

// 示例问句换组时淡入淡出
.example-chip-enter-active,
.example-chip-leave-active {
  transition: opacity 0.3s ease;
}

.example-chip-enter-from,
.example-chip-leave-to {
  opacity: 0;
}

.message-row {
  display: flex;
  width: 100%;
  max-width: 800px;
  margin: 0 auto 20px;

  &.user {
    justify-content: flex-end;

    .message-bubble {
      max-width: min(680px, 80%);
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-7);
    }
  }

  &.assistant {
    justify-content: flex-start;

    .message-bubble {
      max-width: 100%;
      padding: 0;
      background: transparent;
      border-color: transparent;
    }
  }

  &.share-selectable {
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;

    &.is-selected .message-bubble {
      border-color: var(--el-color-primary);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
    }
  }
}

.share-checkbox {
  margin-top: 10px;
  flex-shrink: 0;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.message-role {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.message-content {
  word-break: break-word;
  line-height: 1.6;
  color: var(--el-text-color-primary);

  &--user {
    white-space: pre-wrap;
  }

  &--assistant {
    font-size: 15px;
  }

  &--streaming {
    white-space: pre-wrap;
  }
}

.user-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-message-actions,
.user-edit-actions,
.interrupted-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-message-actions {
  justify-content: flex-end;
}

.interrupted-bar {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.status-hint {
  color: var(--el-text-color-secondary);
}

.streaming-text {
  white-space: pre-wrap;
}

.streaming-cursor {
  animation: blink 1s step-end infinite;
  color: var(--el-color-primary);
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.feedback-bar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  padding-top: 0;
  border-top: none;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.feedback-btn {
  padding: 4px 6px;
  height: auto;
}

.feedback-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--el-border-color-lighter);
}

.share-select-bar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-light);
}

.share-select-count {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-right: 4px;
  white-space: nowrap;
}

.share-card-host {
  position: fixed;
  left: -9999px;
  top: 0;
  z-index: -1;
  pointer-events: none;
}

.query-collapse {
  margin-top: 8px;
  border: none;

  :deep(.el-collapse-item__header) {
    font-size: 0.8rem;
    height: 32px;
    background: transparent;
    border: none;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background: transparent;
  }
}

.query-sources {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.query-sources-title {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.query-source-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 2px;
}

.query-source-ledger {
  font-size: 0.75rem;
  color: var(--el-text-color-secondary);
}

.query-block {
  margin-bottom: 8px;
}

.query-bql,
.query-result {
  margin: 0;
  padding: 8px;
  font-size: 0.75rem;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.query-bql {
  background: var(--el-fill-color-darker);
  color: var(--el-color-primary);
}

.query-result {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}

.input-area {
  flex-shrink: 0;
  padding: 12px 24px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.composer {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 8px 12px 10px;
  background: var(--el-fill-color-light);

  :deep(.el-textarea__inner) {
    box-shadow: none;
    padding: 8px 4px;
    overflow-y: hidden;
  }
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
}

.composer-meta {
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .chat-container {
    padding: 16px;
  }

  .input-area {
    padding: 10px 16px 16px;
  }

  .setup-alert {
    width: calc(100% - 32px);
  }
}

@media (max-width: 640px) {
  .chat-container {
    padding: 12px;
  }

  .input-area {
    padding: 8px 12px 12px;
  }

  .message-row {
    margin-bottom: 16px;
  }

  .message-row.user .message-bubble {
    max-width: 92%;
  }

  .welcome-panel {
    padding: 24px 8px;
  }

  .example-chips {
    grid-template-columns: 1fr;
  }

  .composer-footer {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
