<template>
  <div class="simple-entry">
    <template v-if="parsed.ok">
      <div class="simple-entry-head">
        <span class="simple-entry-date">{{ parsed.date }}</span>
        <span class="simple-entry-payee">{{ parsed.payee || '未填写商户' }}</span>
        <span v-if="parsed.note" class="simple-entry-note">{{ parsed.note }}</span>
        <span v-if="amountInfo" class="simple-entry-amount">{{ amountInfo }}</span>
      </div>

      <div v-if="accounts.length" class="simple-entry-accounts">
        <span v-for="(account, index) in accounts" :key="`${account}-${index}`" class="simple-entry-account"
          :title="account">
          <span class="simple-entry-account-label">{{ accountLabels[index] }}</span>
          <span class="simple-entry-account-name">{{ accountLabel(account) }}</span>
        </span>
      </div>

      <div v-if="otherSide" class="other-account-tip">
        {{ otherSide === 'asset'
          ? '付款账户未识别，已暂记为 Assets:Other'
          : '未匹配分类，已记为 Other 兜底账户；加一条映射后下次自动归类' }}
      </div>

      <div v-if="parsed.tags.length || availableTags.length" class="simple-entry-tags">
        <el-tag v-for="tag in parsed.tags" :key="tag" size="small" :closable="!disabled"
          @close="handleRemoveTag(tag)">
          {{ tag }}
        </el-tag>
        <el-popover v-if="!disabled && availableTags.length" v-model:visible="tagPopoverVisible" placement="bottom-start"
          :width="320" trigger="click">
          <template #reference>
            <el-button size="small" text class="simple-entry-add-tag">+ 标签</el-button>
          </template>
          <el-select v-model="pendingTag" filterable size="small" placeholder="搜索标签" style="width: 100%"
            @change="handleAddTag">
            <el-option v-for="tag in availableTags" :key="tag.full_path" :label="tag.full_path" :value="tag.full_path">
              <span>{{ tag.full_path }}</span>
              <span v-if="tag.description" class="tag-option-desc">{{ tag.description }}</span>
            </el-option>
          </el-select>
        </el-popover>
      </div>

      <div v-if="!disabled" class="simple-entry-footer">
        <el-button size="small" type="primary" plain @click="emit('edit')">修改</el-button>
      </div>
    </template>

    <template v-else>
      <div class="simple-entry-head">
        <span class="simple-entry-date">{{ fallback.date }}</span>
        <span class="simple-entry-payee">{{ fallback.payee }}</span>
        <span v-if="fallback.amount" class="simple-entry-amount">{{ fallback.amount }}</span>
      </div>
      <div class="simple-entry-fallback">
        该条目结构特殊，请切换到「原文」后修改
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { otherAccountSide } from '../../composables/useParseEntryPreview'
import { parseBeancountEntry } from '../../utils/beancount-entry'
import type { FormattedEntry } from '../../types/parse-review'

const props = defineProps<{
  entry: FormattedEntry
  disabled?: boolean
  accountDescriptions: Record<string, string>
  tagOptions: Array<{ full_path: string; description: string; enable: boolean }>
  onPatchTag: (action: 'add' | 'remove', tagPath: string) => Promise<void>
}>()

const emit = defineEmits<{ edit: [] }>()

const parsed = computed(() => parseBeancountEntry(props.entry.edited_formatted))
const otherSide = computed(() => otherAccountSide(props.entry.edited_formatted))

const rootOf = (account: string) => account.split(':')[0] || ''

const amountInfo = computed(() => {
  const primary = parsed.value.postings[0]
  if (!primary || primary.numeric === null || !primary.currency) return ''
  const root = rootOf(primary.account)
  let label = '金额'
  if (root === 'Expenses') label = '支出'
  else if (root === 'Income') label = '收入'
  else if (root === 'Assets' || root === 'Liabilities') label = primary.numeric < 0 ? '转出' : '转入'
  return `${label} ${Math.abs(primary.numeric).toFixed(2)} ${primary.currency}`
})

const accounts = computed(() =>
  parsed.value.ok ? parsed.value.postings.slice(0, 2).map((item) => item.account) : []
)

const accountLabels = computed(() => {
  const firstRoot = rootOf(accounts.value[0] || '')
  const secondRoot = rootOf(accounts.value[1] || '')
  const first = firstRoot === 'Expenses'
    ? '分类'
    : firstRoot === 'Income'
      ? '收入分类'
      : firstRoot === 'Assets' || firstRoot === 'Liabilities'
        ? '转出账户'
        : '账户'
  const second = secondRoot === 'Assets' || secondRoot === 'Liabilities'
    ? firstRoot === 'Expenses' || firstRoot === 'Income'
      ? '付款账户'
      : '转入账户'
    : '对方账户'
  return [first, second]
})

const accountLabel = (account: string) => props.accountDescriptions[account] || account

const fallback = computed(() => {
  const row = props.entry.original_row
  return {
    date: row?.transaction_time?.slice(0, 10) || '-',
    payee: row?.counterparty || row?.commodity || '未命名记录',
    amount: row?.amount !== undefined && row?.amount !== null && row?.amount !== ''
      ? `${row.amount}`
      : ''
  }
})

const tagPopoverVisible = ref(false)
const pendingTag = ref('')

const availableTags = computed(() => {
  const existing = new Set(parsed.value.tags.map((tag) => tag.toLowerCase()))
  return props.tagOptions.filter(
    (tag) => tag.enable !== false && !existing.has(tag.full_path.toLowerCase())
  )
})

const handleAddTag = async (tagPath: string) => {
  if (!tagPath || props.disabled) return
  try {
    await props.onPatchTag('add', tagPath)
    pendingTag.value = ''
    tagPopoverVisible.value = false
    ElMessage.success('标签已添加')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || '添加标签失败')
  }
}

const handleRemoveTag = async (tagPath: string) => {
  if (props.disabled) return
  try {
    await props.onPatchTag('remove', tagPath)
    ElMessage.success('标签已移除')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || '移除标签失败')
  }
}
</script>

<style scoped lang="scss">
.simple-entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.simple-entry-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.simple-entry-date {
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.simple-entry-payee {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.simple-entry-note {
  color: var(--el-text-color-regular);
}

.simple-entry-amount {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.simple-entry-accounts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.simple-entry-account {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.simple-entry-account-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.simple-entry-account-name {
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.other-account-tip {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-warning);
}

.simple-entry-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.simple-entry-add-tag {
  padding: 0 4px;
}

.tag-option-desc {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.simple-entry-fallback {
  font-size: 12px;
  color: var(--el-color-warning);
}

.simple-entry-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
