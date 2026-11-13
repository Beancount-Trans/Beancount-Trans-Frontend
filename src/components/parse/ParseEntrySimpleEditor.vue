<template>
  <el-dialog :model-value="modelValue" :title="disabled ? '查看参考信息' : '修改参考信息'" width="560px"
    :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <p class="editor-tip">
      分类、账户与标签请直接在条目行内修改；这里只调整日期、商户、备注与金额，保存后会重新校验账本格式。
    </p>

    <el-form label-width="96px" class="editor-form">
      <el-form-item label="日期" required>
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期"
          :disabled="disabled" style="width: 100%" />
      </el-form-item>

      <el-form-item label="商户">
        <el-input v-model="form.payee" placeholder="这笔钱付给了谁" :disabled="disabled" clearable />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.note" placeholder="选填，例如用途或说明" :disabled="disabled" clearable />
      </el-form-item>

      <el-form-item label="金额">
        <div class="editor-amount">
          <el-input-number v-model="form.amount" :min="0" :precision="editability.scale" :step="1" :controls="false"
            :disabled="disabled || !editability.editable" style="width: 180px" />
          <span v-if="editability.currency" class="editor-currency">{{ editability.currency }}</span>
          <span v-if="!editability.editable" class="editor-amount-hint">
            {{ editability.reason }}，请切换到「原文」修改金额
          </span>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:modelValue', false)">
        {{ disabled ? '关闭' : '取消' }}
      </el-button>
      <el-button v-if="!disabled" type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  buildAmountChanges,
  buildBeancountEntry,
  getAmountEditability,
  parseBeancountEntry,
  type AmountEditability,
  type ParsedEntry
} from '../../utils/beancount-entry'
import type { FormattedEntry } from '../../types/parse-review'

const props = defineProps<{
  modelValue: boolean
  entry: FormattedEntry | null
  disabled?: boolean
  onSave: (text: string) => Promise<{ validation_warning?: string } | void>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const form = reactive({
  date: '',
  payee: '',
  note: '',
  amount: 0
})

const parsed = ref<ParsedEntry>(parseBeancountEntry(''))
const editability = ref<AmountEditability>({
  editable: false,
  primary: null,
  absolute: null,
  currency: null,
  scale: 2
})
const saving = ref(false)

const resetForm = () => {
  const entry = props.entry
  if (!entry) return
  const result = parseBeancountEntry(entry.edited_formatted)
  parsed.value = result
  editability.value = getAmountEditability(result)
  form.date = result.ok ? result.date : (entry.original_row?.transaction_time?.slice(0, 10) || '')
  form.payee = result.ok ? result.payee : (entry.original_row?.counterparty || '')
  form.note = result.ok ? result.note : ''
  form.amount = editability.value.absolute ?? 0
  saving.value = false
}

watch(
  () => [props.modelValue, props.entry?.uuid],
  ([visible]) => {
    if (visible) resetForm()
  },
  { immediate: true }
)

const handleSave = async () => {
  if (props.disabled || !props.entry) return
  if (!parsed.value.ok) {
    ElMessage.warning('该条目结构特殊，请切换到「原文」修改')
    return
  }
  if (!form.date) {
    ElMessage.warning('请选择日期')
    return
  }

  const amountValue = Number(form.amount)
  if (editability.value.editable && !Number.isFinite(amountValue)) {
    ElMessage.warning('请输入金额')
    return
  }

  const amountChanged = editability.value.editable && editability.value.absolute !== null
    && Math.abs(amountValue - editability.value.absolute) > 1e-9
  const amountChanges = amountChanged
    ? buildAmountChanges(parsed.value, amountValue, editability.value)
    : []

  const nextText = buildBeancountEntry(parsed.value, {
    date: form.date,
    payee: form.payee,
    note: form.note,
    amountChanges
  })

  const check = parseBeancountEntry(nextText)
  if (!check.ok || check.postings.length !== parsed.value.postings.length) {
    ElMessage.error('条目结构已变化，请切换到「原文」修改')
    return
  }

  saving.value = true
  try {
    const result = await props.onSave(nextText)
    if (result && result.validation_warning) {
      ElMessage.warning(result.validation_warning)
    }
    emit('update:modelValue', false)
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.editor-tip {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.editor-form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }
}

.editor-amount {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.editor-currency {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.editor-amount-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-warning);
}
</style>
