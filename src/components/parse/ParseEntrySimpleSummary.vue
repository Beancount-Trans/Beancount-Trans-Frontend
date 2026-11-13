<template>
  <div class="simple-entry">
    <template v-if="parsed.ok">
      <div class="simple-entry-accounts" :class="{ 'is-busy': savingAccount }">
        <div v-for="(account, index) in accounts" :key="`${account}-${index}`" class="simple-entry-account">
          <span class="simple-entry-account-label">{{ accountLabels[index] }}</span>
          <el-popover v-if="!disabled && accountDirectory.length" v-model:visible="accountPopover[index]" placement="bottom-start"
            :width="340" trigger="click">
            <template #reference>
              <button type="button" class="simple-entry-account-name is-editable" :title="account">
                <span class="simple-entry-account-text">{{ accountLabel(account) }}</span>
                <el-icon class="simple-entry-account-edit">
                  <EditPen />
                </el-icon>
              </button>
            </template>
            <div class="simple-entry-account-panel">
              <div class="simple-entry-account-panel-title">选择{{ accountLabels[index] }}</div>
              <el-select :model-value="account" filterable placeholder="搜索账户，回车确认" style="width: 100%"
                @change="(value: string) => handleAccountChange(index, value)">
                <el-option v-for="item in accountOptionsFor(index)" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </div>
          </el-popover>
          <span v-else class="simple-entry-account-name" :title="account">{{ accountLabel(account) }}</span>
        </div>

        <!-- 标签：与账户同行，右对齐 -->
        <div class="simple-entry-tags">
          <el-popover v-if="!disabled && (parsed.tags.length || availableTags.length)" v-model:visible="tagPopoverVisible"
            placement="bottom-end" :width="300" trigger="click">
            <template #reference>
              <button type="button" class="simple-entry-tags-trigger" :title="parsed.tags.join(' ') || '添加标签'">
                <template v-if="visibleTags.length">
                  <span v-for="tag in visibleTags" :key="tag" class="simple-entry-tag">#{{ tag }}</span>
                  <span v-if="hiddenTagCount" class="simple-entry-tag-more">+{{ hiddenTagCount }}</span>
                </template>
                <span v-else class="simple-entry-tag-add">+ 标签</span>
              </button>
            </template>
            <div class="simple-entry-tag-panel">
              <div class="simple-entry-tag-panel-title">标签</div>
              <div class="simple-entry-tag-list">
                <el-tag v-for="tag in parsed.tags" :key="tag" size="small" closable @close="handleRemoveTag(tag)">
                  {{ tag }}
                </el-tag>
                <span v-if="!parsed.tags.length" class="simple-entry-tag-empty">暂无标签</span>
              </div>
              <el-select v-if="availableTags.length" v-model="pendingTag" filterable size="small" placeholder="搜索标签"
                style="width: 100%" @change="handleAddTag">
                <el-option v-for="tag in availableTags" :key="tag.full_path" :label="tag.full_path" :value="tag.full_path">
                  <span>{{ tag.full_path }}</span>
                  <span v-if="tag.description" class="tag-option-desc">{{ tag.description }}</span>
                </el-option>
              </el-select>
            </div>
          </el-popover>
          <button v-else-if="parsed.tags.length" type="button" class="simple-entry-tags-trigger is-static"
            :title="parsed.tags.join(' ')">
            <span v-for="tag in visibleTags" :key="tag" class="simple-entry-tag">#{{ tag }}</span>
            <span v-if="hiddenTagCount" class="simple-entry-tag-more">+{{ hiddenTagCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="otherSide === 'asset'" class="other-account-tip">
        付款账户未识别，已暂记为 Assets:Other
      </div>

      <div class="simple-entry-meta">
        <span class="simple-entry-meta-text" :title="metaText">{{ metaText }}</span>
        <el-button v-if="!disabled" size="small" text class="simple-entry-more" @click="emit('edit')">
          更多
        </el-button>
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
import { EditPen } from '@element-plus/icons-vue'
import { otherAccountSide } from '../../composables/useParseEntryPreview'
import { parseBeancountEntry } from '../../utils/beancount-entry'
import type { FormattedEntry } from '../../types/parse-review'

const props = defineProps<{
  entry: FormattedEntry
  disabled?: boolean
  accountDescriptions: Record<string, string>
  /** 账户目录（账户路径 + 描述），为空时不提供行内改账户 */
  accountDirectory: Array<{ account: string; description: string }>
  tagOptions: Array<{ full_path: string; description: string; enable: boolean }>
  onPatchTag: (action: 'add' | 'remove', tagPath: string) => Promise<void>
  /** 行内修改过账账户：lineIndex 为 Beancount 原文行号 */
  onChangeAccount: (lineIndex: number, account: string) => Promise<unknown>
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

/** 参考信息：日期 · 商户 · 备注 · 金额，单行展示 */
const metaText = computed(() => {
  const payee = parsed.value.payee || '未填写商户'
  return [parsed.value.date, payee, parsed.value.note, amountInfo.value].filter(Boolean).join(' · ')
})

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

// ---------------------------------------------------------------- 行内改账户

const accountPopover = ref<Record<number, boolean>>({})
const savingAccount = ref(false)

const allowedRootsFor = (index: number) => {
  if (index === 1) return ['Assets', 'Liabilities', 'Equity']
  const root = rootOf(parsed.value.postings[0]?.account || '')
  if (root === 'Expenses') return ['Expenses']
  if (root === 'Income') return ['Income']
  if (root === 'Assets' || root === 'Liabilities' || root === 'Equity') {
    return ['Assets', 'Liabilities', 'Equity']
  }
  return ['Assets', 'Expenses', 'Income', 'Liabilities', 'Equity']
}

const accountOptionsFor = (index: number) => {
  const current = parsed.value.postings[index]?.account || ''
  const roots = allowedRootsFor(index)
  const options = props.accountDirectory
    .filter((item) => roots.some((root) => item.account === root || item.account.startsWith(`${root}:`)))
    .map((item) => ({
      value: item.account,
      label: item.description ? `${item.account}（${item.description}）` : item.account
    }))
  if (current && !options.some((item) => item.value === current)) {
    options.unshift({ value: current, label: current })
  }
  return options
}

const handleAccountChange = async (index: number, account: string) => {
  accountPopover.value[index] = false
  const posting = parsed.value.postings[index]
  if (props.disabled || savingAccount.value || !posting || !account || account === posting.account) {
    return
  }
  savingAccount.value = true
  try {
    await props.onChangeAccount(posting.lineIndex, account)
    ElMessage.success('账户已更新')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || '更新账户失败')
  } finally {
    savingAccount.value = false
  }
}

// ---------------------------------------------------------------- 标签

const tagPopoverVisible = ref(false)
const pendingTag = ref('')

/** 标签默认只露 2 个，其余收进悬浮层 */
const MAX_VISIBLE_TAGS = 2
const visibleTags = computed(() => parsed.value.tags.slice(0, MAX_VISIBLE_TAGS))
const hiddenTagCount = computed(() => Math.max(0, parsed.value.tags.length - MAX_VISIBLE_TAGS))

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

.simple-entry-amount {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.simple-entry-accounts {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 20px;

  &.is-busy {
    opacity: 0.7;
    pointer-events: none;
  }
}

/** 标签与账户同行，右对齐；空间不足时整体换行，不被裁切 */
.simple-entry-tags {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
  max-width: 100%;
  margin-left: auto;
}

.simple-entry-account {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.simple-entry-account-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.simple-entry-account-name {
  min-width: 0;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button.simple-entry-account-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
}

button.simple-entry-account-name:hover {
  color: var(--el-color-primary);
}

.simple-entry-account-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.simple-entry-account-edit {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  transition: opacity 0.2s;
}

button.simple-entry-account-name:hover .simple-entry-account-edit,
button.simple-entry-account-name:focus-visible .simple-entry-account-edit {
  opacity: 1;
}

.simple-entry-account-panel-title {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.simple-entry-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.simple-entry-meta-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.simple-entry-more {
  flex-shrink: 0;
  height: auto;
  padding: 0 2px;
  font-size: 12px;
}

.other-account-tip {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-warning);
}

.simple-entry-tags-trigger {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  font: inherit;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.simple-entry-tags-trigger:hover {
  color: var(--el-color-primary);
}

.simple-entry-tags-trigger.is-static {
  cursor: default;
}

.simple-entry-tags-trigger.is-static:hover {
  color: var(--el-text-color-secondary);
}

.simple-entry-tag {
  font-size: 12px;
  white-space: nowrap;
}

.simple-entry-tag-more,
.simple-entry-tag-add {
  font-size: 12px;
  white-space: nowrap;
  color: var(--el-text-color-placeholder);
}

.simple-entry-tag-panel-title {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.simple-entry-tag-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.simple-entry-tag-empty {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
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
</style>
