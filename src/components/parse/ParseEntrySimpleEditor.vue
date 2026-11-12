<template>
  <el-dialog :model-value="modelValue" :title="disabled ? '查看记录' : '修改记录'" width="560px"
    :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
    <p class="editor-tip">
      保存后会重新校验账本格式；涉及多币种的条目请切换到「原文」修改。
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

      <el-form-item :label="categoryLabel">
        <el-select v-model="form.account1" filterable placeholder="选择分类或转出账户"
          :disabled="disabled || !hasAccountDirectory" style="width: 100%">
          <el-option v-for="item in accountOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>

      <el-form-item :label="paymentLabel">
        <el-select v-model="form.account2" filterable placeholder="选择付款或转入账户"
          :disabled="disabled || !hasAccountDirectory" style="width: 100%">
          <el-option v-for="item in paymentOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="!hasAccountDirectory">
        <span class="editor-account-hint">登录后可修改分类与账户</span>
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
import { computed, reactive, ref, watch } from 'vue'
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
  accounts: Array<{ account: string; description: string }>
  onSave: (text: string) => Promise<{ validation_warning?: string } | void>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const form = reactive({
  date: '',
  payee: '',
  note: '',
  amount: 0,
  account1: '',
  account2: ''
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

const rootOf = (account: string) => account.split(':')[0] || ''

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
  form.account1 = result.postings[0]?.account || ''
  form.account2 = result.postings[1]?.account || ''
  saving.value = false
}

watch(
  () => [props.modelValue, props.entry?.uuid],
  ([visible]) => {
    if (visible) resetForm()
  },
  { immediate: true }
)

const allowedCategoryRoots = computed(() => {
  const root = rootOf(parsed.value.postings[0]?.account || '')
  if (root === 'Expenses') return ['Expenses']
  if (root === 'Income') return ['Income']
  if (root === 'Assets' || root === 'Liabilities' || root === 'Equity') {
    return ['Assets', 'Liabilities', 'Equity']
  }
  return ['Assets', 'Expenses', 'Income', 'Liabilities', 'Equity']
})

const buildOptions = (roots: string[], current: string) => {
  const options = props.accounts
    .filter((item) => roots.some((root) => item.account.startsWith(`${root}:`)))
    .map((item) => ({
      value: item.account,
      label: item.description ? `${item.account}（${item.description}）` : item.account
    }))
  if (current && !options.some((item) => item.value === current)) {
    options.unshift({ value: current, label: current })
  }
  return options
}

const accountOptions = computed(() => buildOptions(allowedCategoryRoots.value, form.account1))
const paymentOptions = computed(() => buildOptions(['Assets', 'Liabilities', 'Equity'], form.account2))
const hasAccountDirectory = computed(() => props.accounts.length > 0)

const categoryLabel = computed(() => {
  const root = rootOf(parsed.value.postings[0]?.account || '')
  if (root === 'Expenses') return '分类'
  if (root === 'Income') return '收入分类'
  if (root === 'Assets' || root === 'Liabilities') return '转出账户'
  return '账户'
})

const paymentLabel = computed(() => {
  const firstRoot = rootOf(parsed.value.postings[0]?.account || '')
  const secondRoot = rootOf(parsed.value.postings[1]?.account || '')
  if (secondRoot === 'Assets' || secondRoot === 'Liabilities') {
    return firstRoot === 'Expenses' || firstRoot === 'Income' ? '付款账户' : '转入账户'
  }
  return '对方账户'
})

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
  if (!form.account1 || !form.account2) {
    ElMessage.warning('请选择账户')
    return
  }

  const primary = parsed.value.postings[0]
  const secondary = parsed.value.postings[1]
  const amountValue = Number(form.amount)
  if (editability.value.editable && !Number.isFinite(amountValue)) {
    ElMessage.warning('请输入金额')
    return
  }
  const accountChanges: Array<{ lineIndex: number; account: string }> = []
  if (primary && form.account1 !== primary.account) {
    accountChanges.push({ lineIndex: primary.lineIndex, account: form.account1 })
  }
  if (secondary && form.account2 !== secondary.account) {
    accountChanges.push({ lineIndex: secondary.lineIndex, account: form.account2 })
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
    accountChanges,
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

.editor-amount-hint,
.editor-account-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-warning);
}

.editor-account-hint {
  color: var(--el-text-color-secondary);
}
</style>
