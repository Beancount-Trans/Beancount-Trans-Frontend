<template>
  <div class="recurrence-rule-input">
    <el-input v-model="text" :placeholder="placeholder" clearable :aria-invalid="!!previewError"
      :aria-describedby="previewError ? 'recurrence-rule-error' : undefined" @input="handleInput" @clear="handleClear"
      @blur="emit('blur')" @keyup.enter="emit('submit')" />

    <div v-if="showPreview" class="preview-block" role="status" aria-live="polite">
      <div v-if="previewLoading" class="preview-hint">正在解析…</div>
      <div v-else-if="previewError" id="recurrence-rule-error" class="preview-error" role="alert">{{ previewError }}
      </div>
      <div v-else-if="previewDescribe" class="preview-result">{{ previewDescribe }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { previewRule } from '../../api/recurring'
import type { RecurrenceBasis, RecurringKind } from '../../types/reconciliation'

/** 规则预览结果（向上抛出，供外部自渲染「即时后果」） */
export interface RecurrencePreviewPayload {
  describe: string
  basis?: RecurrenceBasis
  next_occurrences?: string[]
  first_occurrence?: string | null
  immediate_dates?: string[]
  next_expected_date?: string | null
  ended?: boolean
  error: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    showPreview?: boolean
    /** 关闭内部展示但仍向上抛出 preview 事件（供外部自渲染预览） */
    emitPreview?: boolean
    startDate?: string | null
    /** 到期产出类型：参与「创建后的即时后果」计算 */
    kind?: RecurringKind
    placeholder?: string
  }>(),
  {
    showPreview: true,
    emitPreview: false,
    startDate: null,
    kind: 'notify',
    placeholder: '例如：every month on the last / every week on Tuesday, Friday'
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
  (e: 'submit'): void
  (e: 'preview', payload: RecurrencePreviewPayload): void
}>()

const text = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const previewDescribe = ref('')

let previewTimer: ReturnType<typeof setTimeout> | null = null
// 请求序号：丢弃过期响应，避免慢响应覆盖较新的预览结果
let requestSeq = 0

function handleInput(value: string) {
  emit('update:modelValue', value)
  schedulePreview()
}

function handleClear() {
  text.value = ''
  handleInput('')
}

// 防抖预览（~400ms）
function schedulePreview() {
  if (!props.showPreview && !props.emitPreview) return
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(runPreview, 400)
}

async function runPreview() {
  const value = (text.value || '').trim()
  const seq = ++requestSeq
  previewError.value = ''
  previewDescribe.value = ''
  if (!value) {
    emit('preview', { describe: '', error: '' })
    return
  }

  previewLoading.value = true
  try {
    const response = await previewRule({
      rule_text: value,
      start_date: props.startDate,
      kind: props.kind
    })
    if (seq !== requestSeq) return
    previewDescribe.value = response.data.describe || ''
    emit('preview', {
      describe: previewDescribe.value,
      basis: response.data.basis,
      next_occurrences: response.data.next_occurrences,
      first_occurrence: response.data.first_occurrence,
      immediate_dates: response.data.immediate_dates,
      next_expected_date: response.data.next_expected_date,
      ended: response.data.ended,
      error: ''
    })
  } catch (error: unknown) {
    if (seq !== requestSeq) return
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      previewError.value = axiosError.response?.data?.error || '规则解析失败'
    } else {
      previewError.value = '规则解析失败'
    }
    emit('preview', { describe: '', error: previewError.value })
  } finally {
    if (seq === requestSeq) previewLoading.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    // 与输入框当前内容比较，而不是与上次输入回声比较：
    // 预设按钮、表单重置会由父组件直接改值，旧值必须能同步进来，
    // 否则会残留上一个账户/上一次配置的规则
    const next = value || ''
    if (next !== text.value) {
      text.value = next
    }
    schedulePreview()
  }
)

watch(
  () => props.startDate,
  () => schedulePreview()
)

watch(
  () => props.kind,
  () => schedulePreview()
)

onMounted(() => {
  text.value = props.modelValue || ''
  schedulePreview()
})

onUnmounted(() => {
  if (previewTimer) clearTimeout(previewTimer)
  // 使在途请求的响应失效
  requestSeq += 1
})
</script>

<style scoped>
.recurrence-rule-input {
  width: 100%;
}

.preview-block {
  margin-top: 6px;
}

.preview-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.preview-error {
  font-size: 12px;
  color: var(--el-color-danger);
}

.preview-result {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}
</style>
