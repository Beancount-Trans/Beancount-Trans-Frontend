<template>
  <el-dialog v-model="visible" title="新建循环待办" width="640px" :close-on-click-modal="false" append-to-body
    class="recurring-create-dialog">
    <!-- ① 循环周期 -->
    <section class="block">
      <h4 class="block-title">循环周期</h4>
      <div class="presets">
        <el-button v-for="preset in PRESETS" :key="preset.rule" size="small" class="preset-btn"
          @click="applyPreset(preset.rule)">
          {{ preset.label }}
        </el-button>
      </div>
      <RecurrenceRuleInput v-model="form.ruleText" :kind="form.kind" :show-preview="true" :emit-preview="true"
        :start-date="form.startDate" @preview="onPreview" />
    </section>

    <!-- ② 文本/模板 -->
    <section class="block">
      <h4 class="block-title">文本/模板</h4>
      <el-radio-group v-model="form.kind" class="kind-group">
        <el-radio-button label="notify">通知</el-radio-button>
        <el-radio-button label="generate_review">生成审核待办</el-radio-button>
      </el-radio-group>

      <el-input v-if="form.kind === 'notify'" v-model="form.content" maxlength="128" show-word-limit
        placeholder="输入待办文本，将显示在待办卡片上" />
      <el-input v-else v-model="form.content" type="textarea" :rows="6" class="template-input"
        placeholder="输入 Beancount 模板（固定文本，到期原样并入审核队列，不做日期替换）" />

      <p class="block-hint">
        <template v-if="form.kind === 'notify'">到期后生成一张循环待办卡片，卡片文本即上方内容。</template>
        <template v-else>到期后把模板原样并入统一审核队列；模板中的日期等随期变化内容请在审核页手动修改。</template>
      </p>
    </section>

    <!-- ③ 日期 -->
    <section class="block">
      <h4 class="block-title">日期</h4>
      <div class="date-row">
        <span class="date-label">基准日期</span>
        <el-date-picker v-model="form.startDate" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD"
          :clearable="false" placeholder="选择日期" class="date-picker" />
        <el-radio-group v-if="form.kind === 'notify'" :model-value="basis" class="basis-group" @change="setBasis">
          <el-radio-button label="scheduled">按计划日期</el-radio-button>
          <el-radio-button label="completed">完成后起算</el-radio-button>
        </el-radio-group>
      </div>
      <p class="block-hint">
        <template v-if="form.kind === 'notify'">以基准日期为起算锚点；「完成后起算」会按实际完成日期重新推算下一期。</template>
        <template v-else>到期即生成审核条目并立即推进到下一期，不支持「完成后起算」。</template>
      </p>
    </section>

    <!-- ④ 创建后的即时后果（不可逆副作用前置） -->
    <div class="consequence" :class="{ 'is-warn': preview.ended || preview.immediateDates.length > 0 }" role="status"
      aria-live="polite">
      <p class="consequence-title">创建后会发生什么</p>
      <p v-if="preview.error" class="consequence-item danger">规则无法解析，请先修正循环规则。</p>
      <p v-else-if="!preview.describe" class="consequence-item muted">选择或输入循环规则后，这里会显示创建后的即时后果。</p>
      <p v-else-if="preview.ended" class="consequence-item danger">
        该规则无法满足任何日期，创建后定义会立即结束，不会生成待办。
      </p>
      <template v-else>
        <p class="consequence-item">本期待办日期：<strong>{{ preview.firstOccurrence || '—' }}</strong></p>
        <p v-if="preview.immediateDates.length" class="consequence-item warn">
          <template v-if="form.kind === 'generate_review'">
            立即补齐 <strong>{{ preview.immediateDates.length }}</strong> 条审核条目（{{
              preview.immediateDates.join('、') }}），随后本期待办日期推进到
            <strong>{{ preview.nextExpectedDate || '—' }}</strong>
          </template>
          <template v-else>
            立即生成 <strong>1</strong> 条待办卡片（{{ preview.immediateDates[0] }}）
          </template>
        </p>
        <p v-else class="consequence-item">创建后不会立即生成，到期日为本期待办日期 <strong>{{ preview.firstOccurrence }}</strong></p>
      </template>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="submit-hint">{{ submitHint }}</span>
        <div class="dialog-actions">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="handleSubmit">创建</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createRecurringTask } from '../../api/recurring'
import type { RecurrenceBasis } from '../../types/reconciliation'
import { extractApiErrorMessage } from '../../utils/errorHelper'
import RecurrenceRuleInput from './RecurrenceRuleInput.vue'
import type { RecurrencePreviewPayload } from './RecurrenceRuleInput.vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

// 常用预设（均为后端 DSL 解析器已验证可解析的规则）
const PRESETS: Array<{ label: string; rule: string }> = [
  { label: '每天', rule: 'every day' },
  { label: '每 3 天', rule: 'every 3 days' },
  { label: '每个工作日', rule: 'every weekday' },
  { label: '每周', rule: 'every week' },
  { label: '每周二、周五', rule: 'every week on Tuesday, Friday' },
  { label: '每月', rule: 'every month' },
  { label: '每月 1 日', rule: 'every month on the 1st' },
  { label: '每月最后一天', rule: 'every month on the last' },
  { label: '每月最后一个周五', rule: 'every month on the last Friday' },
  { label: '每季度', rule: 'every 3 months' },
  { label: '每年', rule: 'every year' },
  { label: '每年 1 月 15 日', rule: 'every January on the 15th' }
]

function todayString(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const form = reactive({
  ruleText: '',
  kind: 'notify' as 'notify' | 'generate_review',
  content: '',
  startDate: todayString()
})

const preview = reactive({
  describe: '',
  error: '',
  firstOccurrence: null as string | null,
  immediateDates: [] as string[],
  nextExpectedDate: null as string | null,
  ended: false
})

const submitting = ref(false)

const canSubmit = computed(() => {
  if (!form.ruleText.trim()) return false
  if (preview.error) return false
  if (!form.content.trim()) return false
  return true
})

// 提交按钮被禁用时，说明原因（可访问性：不只靠「禁用」表达）
const submitHint = computed(() => {
  if (submitting.value) return ''
  if (!form.ruleText.trim()) return '请先填写或选择循环规则'
  if (preview.error) return '循环规则无法解析，请修改后再提交'
  if (!form.content.trim()) return form.kind === 'notify' ? '请输入待办文本' : '请输入审核模板'
  return ''
})

const WHEN_DONE_RE = /\s+when done$/i

// 基准是 rule_text 的派生视图（单一真源，不双向绑定），避免与文本互写
const basis = computed<RecurrenceBasis>(() =>
  WHEN_DONE_RE.test(form.ruleText.trim()) ? 'completed' : 'scheduled'
)

// 切换基准 = 改写规则文本（单向的意图动作）
function setBasis(value: string | number | boolean | undefined) {
  const next = value as RecurrenceBasis
  const trimmed = form.ruleText.trim()
  if (!trimmed) return
  if (next === 'completed' && !WHEN_DONE_RE.test(trimmed)) {
    form.ruleText = `${trimmed} when done`
  } else if (next === 'scheduled' && WHEN_DONE_RE.test(trimmed)) {
    form.ruleText = trimmed.replace(WHEN_DONE_RE, '')
  }
}

// 预设仅在「完成后起算」时保留 when done 语义
function applyPreset(rule: string) {
  form.ruleText = basis.value === 'completed' ? `${rule} when done` : rule
}

// 「生成审核待办」不支持「完成后起算」：切换过去即剥离 when done 后缀
watch(
  () => form.kind,
  (kind) => {
    if (kind === 'generate_review' && basis.value === 'completed') {
      setBasis('scheduled')
    }
  }
)

function onPreview(payload: RecurrencePreviewPayload) {
  preview.describe = payload.describe
  preview.error = payload.error
  preview.firstOccurrence = payload.first_occurrence ?? null
  preview.immediateDates = payload.immediate_dates ?? []
  preview.nextExpectedDate = payload.next_expected_date ?? null
  preview.ended = payload.ended ?? false
}

function resetForm() {
  form.ruleText = ''
  form.kind = 'notify'
  form.content = ''
  form.startDate = todayString()
  preview.describe = ''
  preview.error = ''
  preview.firstOccurrence = null
  preview.immediateDates = []
  preview.nextExpectedDate = null
  preview.ended = false
}

watch(visible, (open) => {
  if (open) resetForm()
})

async function handleSubmit() {
  const rule = form.ruleText.trim()
  const content = form.content.trim()
  if (!rule) {
    ElMessage.warning('请输入循环规则')
    return
  }
  if (preview.error) {
    ElMessage.warning('循环规则无法解析，请修改后再提交')
    return
  }
  if (!content) {
    ElMessage.warning(form.kind === 'notify' ? '请输入待办文本' : '请输入审核模板')
    return
  }

  const payload = {
    rule_text: rule,
    start_date: form.startDate,
    kind: form.kind,
    ...(form.kind === 'generate_review'
      ? { template: form.content }
      : { note: content })
  }

  submitting.value = true
  try {
    await createRecurringTask(payload)
    ElMessage.success('循环待办已创建')
    visible.value = false
    emit('created')
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '创建失败，请检查循环规则'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.recurring-create-dialog {
  .block {
    margin-bottom: 20px;

    &:last-of-type {
      margin-bottom: 0;
    }
  }

  .block-title {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;

    .preset-btn {
      margin: 0;
    }
  }

  .kind-group {
    margin-bottom: 10px;
  }

  .template-input {
    :deep(.el-textarea__inner) {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
  }

  .block-hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .date-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;

    .date-label {
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }

  .consequence {
    margin-top: 4px;
    padding: 12px 14px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    border-left: 3px solid var(--el-border-color);

    &.is-warn {
      background: var(--el-color-warning-light-9);
      border-left-color: var(--el-color-warning);
    }

    .consequence-title {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .consequence-item {
      margin: 2px 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--el-text-color-regular);

      strong {
        color: var(--el-text-color-primary);
      }

      &.muted {
        color: var(--el-text-color-secondary);
      }

      &.warn {
        color: var(--el-color-warning-dark-2);
      }

      &.danger {
        color: var(--el-color-danger);
      }
    }
  }

  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .submit-hint {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      text-align: left;
    }

    .dialog-actions {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
