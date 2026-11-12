import { ref, computed, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Router } from 'vue-router'
import {
  getAssistantSession,
  getAssistantStatus,
  reconnectAssistantStream,
  stopAssistantMessage,
  streamAssistantChat,
  submitAssistantFeedback,
} from '../api/assistant'
import {
  INTERRUPTED_REPLY,
  type AssistantFeedbackRating,
  type AssistantStatus,
  type AssistantStreamEvent,
  type ChatMessage,
  type QueryRecord,
  type StoredChatMessage,
} from '../types/assistant'

/**
 * 首页（空白会话欢迎区）轮换展示的示例问句池。
 *
 * 与移动端共用同一套问句与文案规范：
 * 1. 必须是疑问句并以「？」结尾，用提问代替功能自述，避免「我可以帮你……」式口吻。
 * 2. 每句只对应一项 Copilot 真实能力：账户与标签、收支、余额与资产负债、大额与渠道、
 *    跨期对比与趋势、洞察与月度总结（洞察模式）、一句话生成待审核条目。
 * 3. 不复述「Copilot 只读查询账本，不会改账」的只读约束，也不承诺账本外能力。
 * 4. 时间用相对表述（上个月、今年、最近三个月），避免文案随日期过期。
 * 5. 条数保持为「一次展示 4 条」的整数倍，避免最后一组不满；换组只发生在
 *    点击示例问句或开启新会话时，平时不自动变化。
 */
const EXAMPLE_QUESTIONS = [
  // 账户与标签
  '我有哪些账户和标签？',
  '哪个标签的花销最多？',
  '我常用哪些支付账户？',
  // 收支
  '上个月支出都花在哪了？',
  '今年以来收入有多少？',
  '今年和去年比花得多吗？',
  // 余额与资产负债
  '现在各账户余额是多少？',
  '我的资产和负债各多少？',
  '我的存款这半年在增加吗？',
  '我今年一共结余了多少？',
  // 大额与类目
  '最近有哪些大额消费？',
  '哪些类目花销涨得最快？',
  '上季度哪些类目花得最多？',
  '哪些支出每个月都在重复？',
  // 跨期与趋势
  '这个月比上个月花得多吗？',
  '最近三个月的支出趋势如何？',
  // 洞察与总结
  '有什么意外的消费发现？',
  '能给我一份消费洞察吗？',
  '能帮我写份月度总结吗？',
  // 一句话记账（只生成待审核条目）
  '能帮我把这笔花销记成账吗？',
]

function createMessageId(): string {
  return crypto.randomUUID()
}

function mapStoredMessage(message: StoredChatMessage): ChatMessage {
  const isGenerating = message.generation_status === 'generating'
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    thinking: message.thinking || '',
    reasoning: message.reasoning || '',
    thinkingExpanded: isGenerating,
    queries: message.queries || [],
    feedback: message.feedback,
    streaming: isGenerating,
    status: isGenerating ? 'thinking' : undefined,
  }
}

export function useAssistantChat(options: {
  sessionId: Ref<string | undefined>
  router: Router
  onSessionsChanged?: () => void
}) {
  const { sessionId: routedSessionId, router, onSessionsChanged } = options

  // 当前会话 id：以「用户意图」为准（新对话/切换会话时立即生效），不直接依赖路由参数。
  // 路由守卫是异步的（会 await /auth/profile/me/），router.push 之后一段时间内
  // route.params.sessionId 仍是旧值，若此时发送消息就会落到上一个会话。
  const activeSessionId = ref<string | undefined>(routedSessionId.value)

  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const sessionLoading = ref(false)
  const deepThink = ref(false)
  const status = ref<AssistantStatus | null>(null)
  const statusLoading = ref(false)
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null
  let activeRequestId = 0
  let userStopRequested = false
  // 首条消息创建会话后会 replace 到新地址；该地址变化不应触发重新从服务端加载
  let skipNextLoadId: string | undefined

  const canChat = computed(() => {
    if (statusLoading.value) return false
    if (!status.value) return false
    const hasAccessibleLedger = status.value.ledger_exists || Boolean(status.value.has_usable_shared_ledger)
    return status.value.api_key_configured && hasAccessibleLedger
  })

  const deepThinkSupported = computed(() => status.value?.deep_think_supported ?? false)

  function getAssistantMessage(): ChatMessage | undefined {
    const last = messages.value[messages.value.length - 1]
    if (last?.role === 'assistant') {
      return last
    }
    return undefined
  }

  function getLastUserMessage(): ChatMessage | undefined {
    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      if (messages.value[i].role === 'user') {
        return messages.value[i]
      }
    }
    return undefined
  }

  function findUserMessageBefore(index: number): string {
    for (let i = index - 1; i >= 0; i -= 1) {
      const message = messages.value[i]
      if (message.role === 'user') {
        return message.content
      }
    }
    return ''
  }

  function appendQuery(record: QueryRecord) {
    const assistant = getAssistantMessage()
    if (!assistant) {
      return
    }
    if (!assistant.queries) {
      assistant.queries = []
    }
    const existing = assistant.queries.findIndex((q) => q.bql === record.bql)
    if (existing >= 0) {
      assistant.queries[existing] = record
    } else {
      assistant.queries.push(record)
    }
  }

  function handleStreamEvent(event: AssistantStreamEvent) {
    switch (event.event) {
      case 'session': {
        const userMessage = getLastUserMessage()
        if (userMessage) {
          userMessage.id = event.data.user_message_id
        }
        const assistant = getAssistantMessage()
        if (assistant && event.data.assistant_message_id) {
          assistant.id = event.data.assistant_message_id
        }
        activeSessionId.value = event.data.id
        if (routedSessionId.value !== event.data.id) {
          skipNextLoadId = event.data.id
          router.replace(`/assistant/${event.data.id}`)
        }
        onSessionsChanged?.()
        break
      }
      case 'status': {
        const assistant = getAssistantMessage()
        if (assistant) {
          assistant.status = event.data.phase
        }
        break
      }
      case 'reasoning_delta': {
        const assistant = getAssistantMessage()
        if (!assistant) break
        assistant.reasoning = (assistant.reasoning || '') + event.data.content
        assistant.thinking = (assistant.thinking || '') + event.data.content
        assistant.thinkingExpanded = true
        break
      }
      case 'thinking_set': {
        const assistant = getAssistantMessage()
        if (!assistant) break
        assistant.thinking = event.data.content
        assistant.reasoning = event.data.reasoning ?? ''
        break
      }
      case 'tool_end':
        if (event.data.bql && event.data.result_preview) {
          appendQuery({
            bql: event.data.bql,
            result_preview: event.data.result_preview,
            fava_path: event.data.fava_path,
            report: event.data.report,
            ledger: event.data.ledger,
          })
        }
        break
      case 'delta': {
        const assistant = getAssistantMessage()
        if (!assistant) break
        assistant.content += event.data.content
        assistant.status = 'writing'
        assistant.thinkingExpanded = false
        break
      }
      case 'done': {
        const assistant = getAssistantMessage()
        if (!assistant) break
        assistant.content = event.data.reply
        assistant.queries = event.data.queries
        assistant.thinking = event.data.thinking || assistant.thinking || ''
        assistant.reasoning = event.data.reasoning || assistant.reasoning || ''
        assistant.streaming = false
        assistant.status = undefined
        assistant.thinkingExpanded = false
        if (event.data.assistant_message_id) {
          assistant.id = event.data.assistant_message_id
        }
        if (event.data.user_message_id) {
          const userMessage = getLastUserMessage()
          if (userMessage) {
            userMessage.id = event.data.user_message_id
          }
        }
        onSessionsChanged?.()
        break
      }
      case 'error': {
        const assistant = getAssistantMessage()
        if (assistant) {
          if (!assistant.content.trim()) {
            assistant.content = event.data.detail
          }
          assistant.streaming = false
          assistant.status = undefined
        }
        error.value = event.data.detail
        break
      }
      default:
        break
    }
  }

  async function fetchStatus() {
    statusLoading.value = true
    error.value = null
    try {
      const { data } = await getAssistantStatus()
      status.value = data
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      error.value = err.response?.data?.detail || '获取 Copilot 状态失败'
    } finally {
      statusLoading.value = false
    }
  }

  async function subscribeStream(
    assistantMessageId: string,
    requestId: number,
    mode: 'send' | 'reconnect',
  ) {
    abortController?.abort()
    abortController = new AbortController()

    try {
      const subscribe = mode === 'reconnect'
        ? reconnectAssistantStream
        : null

      if (subscribe) {
        await subscribe(
          assistantMessageId,
          handleStreamEvent,
          abortController.signal,
        )
      }
    } catch (e: unknown) {
      if (requestId !== activeRequestId) {
        return
      }

      if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
        const assistant = getAssistantMessage()
        if (assistant?.streaming) {
          assistant.streaming = false
          assistant.status = undefined
        }
        return
      }

      const detail = e instanceof Error ? e.message : '连接失败，请稍后重试'
      error.value = detail
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
        abortController = null
        const assistant = getAssistantMessage()
        if (assistant?.streaming) {
          assistant.streaming = false
          assistant.status = undefined
        }
      }
    }
  }

  async function loadSession(id: string) {
    sessionLoading.value = true
    error.value = null
    try {
      const { data } = await getAssistantSession(id)
      messages.value = data.messages.map(mapStoredMessage)

      const last = messages.value[messages.value.length - 1]
      if (last?.role === 'assistant' && last.streaming && last.id) {
        const requestId = ++activeRequestId
        loading.value = true
        await subscribeStream(last.id, requestId, 'reconnect')
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      if (err.response?.status === 404) {
        ElMessage.warning('会话不存在或无权访问')
        activeSessionId.value = undefined
        router.replace('/assistant')
      } else {
        error.value = err.response?.data?.detail || '加载会话失败'
      }
      messages.value = []
    } finally {
      sessionLoading.value = false
    }
  }

  watch(
    routedSessionId,
    async (id, previousId) => {
      if (id === previousId) {
        return
      }

      // 消费一次「首条消息创建会话」标记：该次地址变化时本地已持有该会话的流式状态，无需加载
      const skipLoadId = skipNextLoadId
      skipNextLoadId = undefined
      if (id && id === skipLoadId) {
        return
      }

      if (loading.value) {
        abortSubscription()
      }
      if (!id) {
        // 仅当之后没有再创建新会话时才清空：push('/assistant') 与 replace(新会话) 可能竞争
        if (!activeSessionId.value) {
          messages.value = []
        }
        return
      }
      activeSessionId.value = id
      await loadSession(id)
    },
    { immediate: true },
  )

  function abortSubscription() {
    abortController?.abort()
    abortController = null
    activeRequestId += 1
  }

  async function stop() {
    userStopRequested = true
    const assistant = getAssistantMessage()
    const messageId = assistant?.id

    abortSubscription()

    if (assistant?.streaming) {
      assistant.streaming = false
      assistant.status = undefined
      if (messageId) {
        try {
          await stopAssistantMessage(messageId)
        } catch {
          // 停止请求失败时仍保留本地已展示内容
        }
      }
      if (!assistant.content.trim()) {
        assistant.content = '已停止生成'
      }
    }
    loading.value = false
  }

  async function send(content: string, options?: { editMessageId?: string }): Promise<boolean> {
    const text = content.trim()
    if (!text || loading.value) {
      return false
    }

    const editMessageId = options?.editMessageId
    if (editMessageId) {
      if (!activeSessionId.value) {
        ElMessage.error('当前会话尚未保存，无法编辑历史消息')
        return false
      }
      const editIndex = messages.value.findIndex(
        (message) => message.id === editMessageId && message.role === 'user',
      )
      if (editIndex < 0) {
        ElMessage.error('要编辑的消息不存在')
        return false
      }
      messages.value = messages.value.slice(0, editIndex + 1)
      messages.value[editIndex].content = text
    }

    const requestId = ++activeRequestId
    userStopRequested = false

    if (!editMessageId) {
      messages.value.push({
        id: createMessageId(),
        role: 'user',
        content: text,
      })
    }
    messages.value.push({
      id: createMessageId(),
      role: 'assistant',
      content: '',
      thinking: '',
      reasoning: '',
      thinkingExpanded: true,
      streaming: true,
      status: 'thinking',
      queries: [],
      feedback: null,
    })
    loading.value = true
    error.value = null

    abortController?.abort()
    abortController = new AbortController()

    try {
      const payload = {
        session_id: activeSessionId.value,
        content: text,
        show_bql: false,
        deep_think: deepThink.value,
        ...(editMessageId ? { edit_message_id: editMessageId } : {}),
      }

      await streamAssistantChat(
        payload,
        handleStreamEvent,
        abortController.signal,
      )

      if (requestId !== activeRequestId) {
        return true
      }

      const assistant = getAssistantMessage()
      if (assistant?.streaming) {
        assistant.streaming = false
        assistant.status = undefined
        if (!assistant.content.trim()) {
          const incompleteMessage = '未收到完整回复，请重试'
          assistant.content = incompleteMessage
          error.value = incompleteMessage
        }
      }
      return true
    } catch (e: unknown) {
      if (requestId !== activeRequestId) {
        return true
      }

      if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
        const assistant = getAssistantMessage()
        if (assistant) {
          assistant.streaming = false
          assistant.status = undefined
          if (!assistant.content.trim() && userStopRequested) {
            assistant.content = '已停止生成'
          } else if (!assistant.content.trim()) {
            const timeoutMessage = e.message || '响应超时，请重试'
            assistant.content = timeoutMessage
            error.value = timeoutMessage
          }
        }
        return true
      }

      const err = e as Error & { status?: number }
      let detail = err.message || '发送失败，请稍后重试'
      if (err.status === 409) {
        detail = detail || '上一轮回复仍在生成中，请稍候或停止后再试'
      }
      error.value = detail
      ElMessage.warning(detail)

      const assistant = getAssistantMessage()
      if (assistant) {
        messages.value.pop()
        if (!editMessageId) {
          const lastUser = getLastUserMessage()
          if (lastUser && !lastUser.id) {
            messages.value.pop()
          }
        }
        assistant.streaming = false
        assistant.status = undefined
      }
      return false
    } finally {
      if (requestId === activeRequestId) {
        loading.value = false
        abortController = null
      }
    }
  }

  async function submitFeedback(
    messageIndex: number,
    rating: AssistantFeedbackRating,
    comment = '',
  ) {
    const message = messages.value[messageIndex]
    if (!message || message.role !== 'assistant' || message.streaming || !message.id) {
      return
    }

    const nextRating = message.feedback === rating ? null : rating
    message.feedbackSubmitting = true

    try {
      const { data } = await submitAssistantFeedback({
        message_id: message.id,
        rating: nextRating,
        user_message: findUserMessageBefore(messageIndex),
        assistant_reply: message.content,
        queries: message.queries || [],
        comment: nextRating === 'dislike' ? comment : '',
      })
      message.feedback = data.rating
      ElMessage.success(nextRating ? '感谢你的反馈' : '已取消评价')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      ElMessage.error(err.response?.data?.detail || '提交反馈失败')
    } finally {
      message.feedbackSubmitting = false
    }
  }

  function isInterruptedAssistant(message: ChatMessage | undefined): boolean {
    if (!message || message.role !== 'assistant' || message.streaming) {
      return false
    }
    const text = message.content.trim()
    return !text || text === INTERRUPTED_REPLY
  }

  async function retryFromAssistant(index: number): Promise<boolean> {
    for (let i = index - 1; i >= 0; i -= 1) {
      const message = messages.value[i]
      if (message.role === 'user' && message.id) {
        return send(message.content, { editMessageId: message.id })
      }
    }
    ElMessage.error('找不到可重新生成的用户消息')
    return false
  }

  function startNewChat() {
    abortSubscription()
    // 先清空当前会话，避免路由参数延迟更新时把新提问发到上一个会话
    activeSessionId.value = undefined
    messages.value = []
    error.value = null
    loading.value = false
    if (routedSessionId.value) {
      router.push('/assistant')
    }
  }

  return {
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
    exampleQuestions: EXAMPLE_QUESTIONS,
    fetchStatus,
    send,
    stop,
    abortSubscription,
    submitFeedback,
    startNewChat,
    loadSession,
    isInterruptedAssistant,
    retryFromAssistant,
  }
}
