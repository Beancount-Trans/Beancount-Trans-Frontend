<template>
  <div class="reconciliation-form">
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <div class="header-content">
            <div class="header-title-wrapper">
              <span class="header-title">对账</span>
              <el-tag v-if="isFirstReconciliation" type="success" size="small" effect="light">
                首次对账
              </el-tag>
            </div>
            <span class="header-account">{{ accountName }}</span>
          </div>
        </div>
      </template>

      <div class="form-content">
        <!-- 基本信息区 -->
        <el-form :model="formData" label-width="100px" class="desktop-form">
          <el-form-item label="币种">
            <el-select v-model="formData.currency" @change="onCurrencyChange" style="width: 100%">
              <el-option v-for="balance in availableCurrencies" :key="balance.currency"
                :label="`${balance.currency} (余额: ${balance.expected_balance.toFixed(2)})`" :value="balance.currency" />
            </el-select>
          </el-form-item>

          <el-form-item label="对账时间点">
            <div class="timing-selector">
              <el-radio-group v-model="formData.reconciliationTiming">
                <el-radio label="end_of_day">当天最后一笔交易后</el-radio>
                <el-radio label="start_of_next_day">第二天第一笔交易前</el-radio>
              </el-radio-group>
              <!-- <el-alert
                v-if="formData.reconciliationTiming === 'end_of_day'"
                type="info"
                :closable="false"
                class="timing-alert"
              >
                <strong>输入的余额包含今天发生的所有交易</strong>
              </el-alert> -->
              <!-- <el-alert
                v-if="formData.reconciliationTiming === 'start_of_next_day'"
                type="info"
                :closable="false"
                class="timing-alert"
              >
                <strong>输入的余额仅截止到昨天，不包含今天的任何交易</strong>
              </el-alert> -->
            </div>
          </el-form-item>

          <!-- 余额对比区（核心） -->
          <el-form-item label="余额对比">
            <div class="balance-comparison">
              <div class="balance-item">
                <div class="balance-label">预期余额</div>
                <div class="balance-value">{{ formData.expectedBalance.toFixed(2) }}</div>
              </div>
              <div class="balance-separator">→</div>
              <div class="balance-item">
                <div class="balance-label">实际余额</div>
                <el-input-number v-model="formData.actualBalance" :controls="false" :precision="2" placeholder="输入实际余额"
                  style="width: 100%" />
              </div>
              <div v-if="formData.actualBalance !== undefined && formData.actualBalance !== null && hasBaseDifference"
                class="difference-badge"
                :class="{ 'positive': remainingDifference > 0, 'negative': remainingDifference < 0 }">
                <div class="difference-main">
                  差额：{{ remainingDifference > 0 ? '+' : '' }}{{ remainingDifference.toFixed(2) }}
                </div>
              </div>
            </div>
          </el-form-item>
        </el-form>

        <!-- 差额分配区 -->
        <div class="allocation-section">
          <el-divider content-position="left">
            <span class="section-title">差额分配</span>
          </el-divider>
          <template v-if="!showAdvancedAllocation">
            <el-alert type="success" :closable="false" :show-icon="false" class="first-reconciliation-alert">
              <template #title>
                <div class="alert-title-flex">
                  <div class="alert-text-lines">
                    <p>💡 系统检测到这是该账户的首次对账。</p>
                    <p>您只需根据实际「对账时间点」输入上方的「实际余额」即可，</p>
                    <p>系统会自动将差额记录为期初余额 (<code>Equity:Opening-Balances</code>)。</p>
                  </div>
                  <el-button type="primary" link @click="showAdvancedAllocation = true">
                    自定义分配 (高级)
                  </el-button>
                </div>
              </template>
            </el-alert>
          </template>
          <template v-else>
            <el-table :data="formData.transactionItems" border class="allocation-table">
              <el-table-column label="账户" min-width="300">
                <template #default="{ row }">
                  <AccountSelector v-model="row.accountId" placeholder="选择账户" compact :account-tree="accountTree"
                    @change="(account) => handleAccountChange(row, account)" />
                </template>
              </el-table-column>
              <el-table-column label="金额" min-width="200">
                <template #default="{ row }">
                  <el-input-number v-model="row.amount" :controls="false" :precision="2" placeholder="留空自动分配剩余金额"
                    style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="180" align="center">
                <template #default="{ row, $index }">
                  <div class="action-cell">
                    <!-- 日期选择器（仅当金额有值时显示） -->
                    <div v-if="row.amount !== undefined && row.amount !== null" class="date-picker-wrapper">
                      <el-date-picker v-model="row.date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD"
                        :clearable="true" placeholder="默认为对账日期" :max-date="asOfDate ? new Date(asOfDate) : undefined"
                        :min-date="getMinDate()" :default-value="allocationDatePickerDefault"
                        class="no-border-date-picker" placement="bottom-start" :teleported="true" :popper-options="{
                          modifiers: [
                            {
                              name: 'offset',
                              options: {
                                offset: [0, 4]
                              }
                            },
                            {
                              name: 'preventOverflow',
                              options: {
                                boundary: 'viewport',
                                padding: 8
                              }
                            },
                            {
                              name: 'computeStyles',
                              options: {
                                adaptive: true,
                                roundOffsets: true
                              }
                            }
                          ]
                        }" />
                    </div>
                    <!-- 删除按钮 -->
                    <el-button type="danger" size="small" text :disabled="formData.transactionItems.length === 1"
                      @click="removeItem($index)">
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <div class="allocation-actions">
              <el-button type="primary" plain @click="addItem">
                + 添加账户
              </el-button>
            </div>
            <div v-if="validationErrors.length > 0" class="validation-errors">
              <p v-for="(error, i) in validationErrors" :key="i" class="error">
                {{ error }}
              </p>
            </div>
          </template>
        </div>

        <!-- 操作按钮区 -->
        <div class="action-section">
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            提交
          </el-button>
          <el-button v-if="showRevokeButton" type="warning" @click="handleRevokeReconciliation" :loading="revoking">
            撤销上次对账
          </el-button>
          <el-button @click="handleBack">返回</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { startReconciliation, executeReconciliation, revokeReconciliation } from '../../api/reconciliation'
import AccountSelector from '../../components/common/AccountSelector.vue'
import { useReconciliationDraft } from '../../composables/useReconciliationDraft'
import axios from '../../utils/request'
import type {
  ReconciliationFormData,
  TransactionItem,
  CurrencyBalance
} from '../../types/reconciliation'

// 账户选项类型定义（与 AccountSelector 保持一致）
interface AccountOption {
  id: number
  account: string
  parent?: number
  parent_account?: string
  account_type: string
  description?: string
  enable: boolean
  mapping_count?: {
    expense: number
    assets: number
    income: number
    total: number
  }
  children?: AccountOption[]
}

const route = useRoute()
const router = useRouter()

const taskIdRef = computed(() => {
  const id = route.params.id
  return id != null && id !== '' ? Number(id) : null
})

const loading = ref(false)
const submitting = ref(false)
const accountName = ref('')
const availableCurrencies = ref<Array<{ currency: string, expected_balance: number }>>([])
const accountTree = ref<AccountOption[]>([])
const asOfDate = ref<string>('')  // 对账截止日期，用于限制日期选择器的最大日期
const lastReconciliationDate = ref<string | null>(null)  // 上一次对账日期，用于限制日期选择器的最小日期
const lastCompletedTaskId = ref<number | null>(null)  // 最近一次已完成对账任务 id，用于撤销
const revoking = ref(false)  // 撤销请求中

const isFirstReconciliation = ref(false) // 是否为该账户首次对账
const showAdvancedAllocation = ref(true) // 是否展开高级分配表单

const formData = ref<ReconciliationFormData>({
  expectedBalance: 0,
  actualBalance: undefined,
  currency: 'CNY',
  reconciliationTiming: 'end_of_day',
  transactionItems: [{ account: '', accountId: null, amount: undefined, date: null }]
})

const { getDraft, clearDraft, applyDraft, saveDraft } = useReconciliationDraft(taskIdRef, formData)

// 移除确认框，离开时默认保存草稿后直接放行
onBeforeRouteLeave(async (to, from, next) => {
  saveDraft()
  next()
})

onMounted(async () => {
  await loadReconciliationData()
})

// 路由 taskId 变化时（如撤销后跳转到新任务）重新加载数据，使「上次对账」与撤销按钮状态与后端一致
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId != null && newId !== '' && String(newId) !== String(oldId)) {
      loadReconciliationData()
    }
  }
)

async function loadReconciliationData() {
  loading.value = true
  try {
    const taskId = Number(route.params.id)
    const response = await startReconciliation(taskId)

    // 存储所有币种余额
    availableCurrencies.value = response.data.balances.map((b: CurrencyBalance) => ({
      currency: b.currency,
      expected_balance: parseFloat(b.expected_balance)
    }))

    // 使用默认币种或第一个币种
    const defaultCurrency = response.data.default_currency ||
      (availableCurrencies.value.length > 0 ? availableCurrencies.value[0].currency : 'CNY')

    formData.value.currency = defaultCurrency

    // 设置对应币种的预期余额
    const balanceInfo = availableCurrencies.value.find(b => b.currency === defaultCurrency)
    formData.value.expectedBalance = balanceInfo?.expected_balance || 0

    accountName.value = response.data.account_name

    isFirstReconciliation.value = response.data.is_first_reconciliation
    // 首次对账默认折叠高级分配表单
    if (isFirstReconciliation.value) {
      showAdvancedAllocation.value = false
    } else {
      showAdvancedAllocation.value = true
    }

    // 存储 as_of_date（用于限制日期选择器的最大日期）
    asOfDate.value = response.data.as_of_date

    // 存储上一次对账日期（用于限制日期选择器的最小日期）
    lastReconciliationDate.value = response.data.last_reconciliation_date || null
    lastCompletedTaskId.value = response.data.last_completed_task_id ?? null

    // 确保账户树已加载（预填差额分配时需要按 account 匹配 accountId）
    if (accountTree.value.length === 0) {
      await loadAccounts()
    }

    const prefilled = response.data.last_reconciliation_transaction_items
    const hasPrefilled = prefilled && Array.isArray(prefilled) && prefilled.length > 0

    const draft = getDraft()
    const hasSubstantialDraft =
      draft &&
      (draft.actualBalance != null ||
        (draft.transactionItems &&
          draft.transactionItems.some(
            (i: { account?: string; amount?: number | null }) =>
              (i.account && i.account.trim()) || i.amount != null
          )))

    // 本地草稿与服务端预填协作：有草稿时恢复草稿，有预填时将撤销后的差额分配合并进表单（并随 watch 写入草稿）
    if (hasSubstantialDraft) {
      applyDraft(draft!)
    }
    if (hasPrefilled) {
      const prefilledMapped = prefilled.map((item: { account: string; amount?: string | null; is_auto?: boolean; date?: string | null }) => {
        const acc = findAccountByName(accountTree.value, item.account)
        return {
          account: item.account,
          accountId: acc ? acc.id : null,
          amount: item.amount != null ? parseFloat(item.amount) : undefined,
          date: item.date || null
        }
      })
      const appendPrefilledFlag = `reconciliation_append_prefilled_${taskId}`
      const shouldAppendPrefilled = hasSubstantialDraft && sessionStorage.getItem(appendPrefilledFlag) !== null
      if (shouldAppendPrefilled) {
        // 仅当点击撤销对账后首次加载时，将预填条目追加到现有草稿
        formData.value.transactionItems = [...formData.value.transactionItems, ...prefilledMapped]
        try {
          sessionStorage.removeItem(appendPrefilledFlag)
        } catch {
          /* ignore */
        }
      } else if (!hasSubstantialDraft) {
        // 无草稿时，使用预填作为差额分配
        formData.value.transactionItems = prefilledMapped
      }
    }
    if (hasSubstantialDraft) {
      clearDraft()
    }

    if (!hasSubstantialDraft && !hasPrefilled) {
      // 无草稿且无预填时，根据是否首次对账设置默认账户
      const defaultEquityAccountName = response.data.is_first_reconciliation
        ? 'Equity:Opening-Balances'
        : (response.data.default_allocation_account || 'Equity:Adjustments')

      const defaultAccount = findAccountByName(accountTree.value, defaultEquityAccountName)

      if (formData.value.transactionItems.length > 0 && defaultAccount) {
        formData.value.transactionItems[0].account = defaultAccount.account
        formData.value.transactionItems[0].accountId = defaultAccount.id
        formData.value.transactionItems[0].date = null
      } else if (formData.value.transactionItems.length > 0) {
        formData.value.transactionItems[0].account = defaultEquityAccountName
        formData.value.transactionItems[0].date = null
      }
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { message?: string } } }
      ElMessage.error(axiosError.response?.data?.message || '加载对账数据失败')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
    router.back()
  } finally {
    loading.value = false
  }
}

// 获取账户树形数据
async function loadAccounts() {
  try {
    const response = await axios.get('/account/tree/')
    if (Array.isArray(response.data)) {
      accountTree.value = response.data as AccountOption[]
    } else if (response.data && Array.isArray(response.data.results)) {
      accountTree.value = response.data.results as AccountOption[]
    } else {
      accountTree.value = []
    }
  } catch (error: any) {
    console.error('获取账户树失败:', error)
    accountTree.value = []
  }
}

// 根据账户名称查找账户
function findAccountByName(accounts: AccountOption[], accountName: string): AccountOption | null {
  for (const account of accounts) {
    if (account.account === accountName) {
      return account
    }
    if (account.children) {
      const found = findAccountByName(account.children, accountName)
      if (found) return found
    }
  }
  return null
}

// 处理账户选择变化
function handleAccountChange(row: TransactionItem, account: any) {
  if (account && account.account) {
    row.account = account.account
  } else {
    row.account = ''
  }
}

function onCurrencyChange() {
  // 更新预期余额
  const balanceInfo = availableCurrencies.value.find(b => b.currency === formData.value.currency)
  formData.value.expectedBalance = balanceInfo?.expected_balance || 0
}

function addItem() {
  formData.value.transactionItems.push({
    account: '',
    accountId: null,
    amount: undefined,
    date: null
  })
}

function removeItem(index: number) {
  if (formData.value.transactionItems.length > 1) {
    formData.value.transactionItems.splice(index, 1)
  }
}

// 基础差额（实际余额 - 预期余额）
const baseDifference = computed(() => {
  const actualBalance = formData.value.actualBalance ?? 0
  return actualBalance - formData.value.expectedBalance
})

// 已分配的金额总和（保留符号）
// 在复式记账中：实际余额 + 差额分配 = 预期余额
// 所以：差额分配 = 预期余额 - 实际余额 = -基础差额
const totalAllocated = computed(() => {
  return formData.value.transactionItems
    .filter((item: TransactionItem) => item.amount !== undefined && item.amount !== null)
    .reduce((sum: number, item: TransactionItem) => sum + (item.amount || 0), 0)
})

// 展示用的差额：随表单分配动态调整
// 在复式记账中：实际余额 + 差额分配 = 预期余额，故差额 = 实际余额 + 已分配金额 - 预期余额
// 分配完成后（已分配金额 = 预期余额 - 实际余额）归零
const remainingDifference = computed(() => {
  return baseDifference.value + totalAllocated.value
})

// 将金额转换为整数（以分为单位）进行精确比较，避免浮点数精度问题
function toCents(amount: number): number {
  return Math.round(amount * 100)
}

// 判断是否有基础差额（使用整数比较避免浮点数精度问题）
const hasBaseDifference = computed(() => {
  return toCents(Math.abs(baseDifference.value)) > 0
})

// 获取日期选择器的最小日期（上一次对账日期的下一天）
function getMinDate(): Date | undefined {
  if (!lastReconciliationDate.value) {
    return undefined
  }
  const lastDate = new Date(lastReconciliationDate.value)
  lastDate.setDate(lastDate.getDate() + 1)  // 下一天
  return lastDate
}

// 当前表单对应的 as_of_date（与提交逻辑一致，用于撤销按钮显示条件）
const computedAsOfDate = computed(() => {
  const today = new Date()
  if (formData.value.reconciliationTiming === 'start_of_next_day') {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }
  return today.toISOString().split('T')[0]
})

// 差额分配日期面板默认定位：对账截止日前 15 天（月间隔对账时减少翻页）
const allocationDatePickerDefault = computed(() => {
  const base = computedAsOfDate.value
    ? new Date(`${computedAsOfDate.value}T12:00:00`)
    : new Date()
  base.setDate(base.getDate() - 15)
  return base
})

// 仅当「as_of_date 与上次相同」或「某条差额分配日期 ≤ 上次对账日期」时显示撤销按钮
const showRevokeButton = computed(() => {
  if (!lastReconciliationDate.value || lastCompletedTaskId.value == null) return false
  const last = lastReconciliationDate.value
  if (computedAsOfDate.value === last) return true
  return formData.value.transactionItems.some(
    (item: TransactionItem) => item.date && item.date <= last
  )
})

const validationErrors = computed(() => {
  const errors: string[] = []

  // 如果无基础差额，检查是否填写了差额分配
  // 使用整数比较避免浮点数精度问题
  if (toCents(Math.abs(baseDifference.value)) === 0) {
    // 检查是否有填写了金额的差额分配条目
    const itemsWithAmount = formData.value.transactionItems.filter(
      (item: TransactionItem) => item.account && (item.amount !== undefined && item.amount !== null)
    )

    if (itemsWithAmount.length > 0) {
      errors.push('预期余额和实际余额相等时，差额分配中的金额需留空')
    }

    return errors
  }

  // 检查是否有填写差额分配的条目
  const itemsWithAccount = formData.value.transactionItems.filter(
    (item: TransactionItem) => item.account
  )

  // 如果没有选择任何账户，不需要验证
  if (itemsWithAccount.length === 0) {
    return errors
  }

  // 检查所有选择的账户
  for (const item of itemsWithAccount) {
    if (!item.account) {
      errors.push('所有条目必须选择账户')
      break
    }
    // 检查账户不能与对账账户相同
    if (item.account === accountName.value) {
      errors.push(`差额分配账户不能与对账账户相同（${accountName.value}）`)
      break
    }
  }

  // 检查日期不能早于上一次对账日期
  if (lastReconciliationDate.value) {
    const minDate = new Date(lastReconciliationDate.value)
    minDate.setDate(minDate.getDate() + 1)  // 下一天

    for (let i = 0; i < formData.value.transactionItems.length; i++) {
      const item = formData.value.transactionItems[i]
      const itemDate = item.date

      // 只检查有日期的条目（is_auto=false 的条目）
      if (itemDate && item.amount !== undefined && item.amount !== null) {
        const date = new Date(itemDate)
        if (date <= new Date(lastReconciliationDate.value)) {
          const minDateStr = minDate.toISOString().split('T')[0]
          errors.push(`条目 ${i + 1} 的日期 ${itemDate} 不能早于或等于上一次对账日期 ${lastReconciliationDate.value}（必须在 ${minDateStr} 或之后）`)
        }
      }
    }
  }

  // 检查是否有多个账户金额为空（只允许一个账户金额为空，由后端自动分配）
  const emptyAmountCount = formData.value.transactionItems.filter(
    (item: TransactionItem) => item.account && (item.amount === undefined || item.amount === null)
  ).length

  if (emptyAmountCount > 1) {
    errors.push('只能有一个账户的金额为空（自动分配剩余差额）')
    return errors
  }

  // 如果没有自动分配账户（所有账户都填写了金额），需要验证金额总和是否匹配
  // 金额必须完全闭环，不允许任何误差
  // 使用整数比较避免浮点数精度问题
  if (emptyAmountCount === 0) {
    const targetAllocation = -baseDifference.value
    const targetAllocationCents = toCents(targetAllocation)
    const totalAllocatedCents = toCents(totalAllocated.value)

    if (targetAllocationCents !== totalAllocatedCents) {
      errors.push(`已分配金额与差额不匹配（基础差额：${baseDifference.value.toFixed(2)}，已分配：${totalAllocated.value.toFixed(2)}，应分配：${targetAllocation.toFixed(2)}）`)
    }
  }

  return errors
})

async function handleSubmit() {
  // 验证实际余额是否已填写
  if (formData.value.actualBalance === undefined || formData.value.actualBalance === null) {
    ElMessage.error('请输入实际余额')
    return
  }

  if (validationErrors.value.length > 0) {
    ElMessage.error('请修正表单错误')
    return
  }

  submitting.value = true
  try {
    const taskId = Number(route.params.id)

    // 准备交易条目，如果金额为空则设置 is_auto: true
    const validTransactionItems = formData.value.transactionItems
      .filter((item: TransactionItem) => item.account) // 只保留选择了账户的条目
      .map((item: TransactionItem) => {
        // 如果金额为空，设置 is_auto: true，amount: null
        if (item.amount === undefined || item.amount === null) {
          return {
            account: item.account,
            amount: null,
            is_auto: true
          }
        }
        // 如果金额不为空，正常提交（包含日期字段）
        return {
          account: item.account,
          amount: item.amount,
          is_auto: false,
          date: item.date || null  // 日期字段，如果未指定则为 null
        }
      })

    // 根据对账时间点计算 as_of_date
    const today = new Date()
    let asOfDate: Date
    if (formData.value.reconciliationTiming === 'start_of_next_day') {
      // 第二天第一笔交易前：提前一天
      asOfDate = new Date(today)
      asOfDate.setDate(asOfDate.getDate() - 1)
    } else {
      // 当天最后一笔交易后：使用今天
      asOfDate = today
    }

    // 格式化为 YYYY-MM-DD
    const asOfDateStr = asOfDate.toISOString().split('T')[0]

    // 验证 as_of_date 必须大于上一次对账日期
    if (lastReconciliationDate.value) {
      const lastDate = new Date(lastReconciliationDate.value)
      lastDate.setHours(0, 0, 0, 0)
      const currentAsOfDate = new Date(asOfDateStr)
      currentAsOfDate.setHours(0, 0, 0, 0)

      if (currentAsOfDate.getTime() === lastDate.getTime()) {
        ElMessage.error(`该账户已有 ${asOfDateStr} 的对账记录，不允许重复对账同一日期。若需重做该日对账，请点击「撤销上一次对账」后再提交。`)
        submitting.value = false
        return
      } else if (currentAsOfDate < lastDate) {
        ElMessage.error(`对账日期 ${asOfDateStr} 不能早于上一次对账日期 ${lastReconciliationDate.value}，只能对账未来的日期`)
        submitting.value = false
        return
      }
    }

    await executeReconciliation(taskId, {
      actual_balance: formData.value.actualBalance,
      currency: formData.value.currency,
      transaction_items: validTransactionItems,
      as_of_date: asOfDateStr
    })

    clearDraft()
    ElMessage.success('对账完成')
    // 新用户渠道对账引导：完成后回到账户管理页继续配置/下一个账户
    if (route.query.from === 'channel-setup') {
      router.push('/config/accounts?guide=channel-cycle&phase=first')
    } else {
      router.push('/tasks')
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response?: {
          data?: {
            message?: string
            non_field_errors?: string[]
            error?: string
            transaction_items?: string[] | string
            [key: string]: unknown
          }
        }
      }
      const errorData = axiosError.response?.data

      // 处理 DRF ValidationError 格式
      // 1. 优先处理字段级别的错误（如 transaction_items）
      if (errorData?.transaction_items) {
        const transactionErrors = Array.isArray(errorData.transaction_items)
          ? errorData.transaction_items
          : [errorData.transaction_items]
        // 显示所有 transaction_items 相关的错误
        transactionErrors.forEach((err: string) => {
          ElMessage.error(err)
        })
        return
      }

      // 2. 处理其他字段级别的错误（遍历所有字段）
      const fieldErrors: string[] = []
      if (errorData) {
        for (const key in errorData) {
          // 跳过已处理的字段和通用错误字段
          if (key === 'message' || key === 'non_field_errors' || key === 'error') {
            continue
          }
          const fieldValue = errorData[key]
          if (Array.isArray(fieldValue)) {
            fieldErrors.push(...fieldValue.map((err: string) => `${key}: ${err}`))
          } else if (typeof fieldValue === 'string') {
            fieldErrors.push(`${key}: ${fieldValue}`)
          }
        }
      }

      if (fieldErrors.length > 0) {
        // 显示所有字段错误
        fieldErrors.forEach((err: string) => {
          ElMessage.error(err)
        })
        return
      }

      // 3. 处理通用错误：优先使用 message，其次使用 non_field_errors，最后使用 error
      const errorMessage = errorData?.message ||
        (errorData?.non_field_errors && errorData.non_field_errors[0]) ||
        errorData?.error ||
        '对账失败'
      ElMessage.error(errorMessage)
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    submitting.value = false
  }
}

async function handleRevokeReconciliation() {
  const taskId = lastCompletedTaskId.value
  if (taskId == null) return
  try {
    await ElMessageBox.confirm(
      '撤销后将作废上次对账，仅适用于上次对账金额或条目错误的情况。确定要撤销吗？',
      '撤销对账',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  revoking.value = true
  try {
    const { data } = await revokeReconciliation(taskId)
    if (data.entries_commented > 0) {
      ElMessage.success(`已撤销并注释 ${data.entries_commented} 行`)
    } else {
      ElMessage.success('已撤销，可对同一日期重新对账')
    }
    const currentId = route.params.id != null && route.params.id !== '' ? Number(route.params.id) : null
    if (data.new_task_id) {
      // 标记「撤销后首次加载」时需将预填追加到草稿，避免每次打开表单都追加
      try {
        sessionStorage.setItem(`reconciliation_append_prefilled_${data.new_task_id}`, '1')
      } catch {
        /* ignore */
      }
      if (data.new_task_id === currentId) {
        // 仍为当前任务（后端更新了该待办），重新拉取 start 数据以更新「上次对账」与撤销按钮
        await loadReconciliationData()
      } else {
        router.push(`/tasks/${data.new_task_id}`)
      }
    } else {
      router.push('/tasks')
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      ElMessage.error(axiosError.response?.data?.error || '撤销对账失败')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    revoking.value = false
  }
}

function handleBack() {
  router.back()
}
</script>

<style scoped lang="scss">
.reconciliation-form {
  padding: 20px;
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 120px);

  :deep(.el-card) {
    width: 100%;
    max-width: 1200px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  }

  .card-header {
    .header-content {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .header-title-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .header-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--ep-text-color-primary);
      }

      .header-account {
        font-size: 13px;
        color: var(--ep-text-color-regular);
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
        word-break: break-all;
        line-height: 1.4;
      }
    }
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  // 桌面端表单样式
  .desktop-form {
    :deep(.el-form-item) {
      margin-bottom: 22px;
    }

    .timing-selector {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      width: 100%;

      .timing-alert {
        padding: 6px 12px;
        margin-top: 4px;
        max-width: 400px;

        :deep(.el-alert__content) {
          padding: 0;
        }
      }
    }
  }

  // 余额对比区（核心）
  .balance-comparison {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background-color: var(--ep-fill-color-extra-light);
    border-radius: 8px;
    border: 1px solid var(--ep-border-color-lighter);
    position: relative;

    .balance-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .balance-label {
        font-size: 13px;
        color: var(--ep-text-color-regular);
        font-weight: 500;
      }

      .balance-value {
        font-size: 24px;
        color: var(--ep-color-primary);
        font-weight: 600;
        line-height: 1.4;
      }
    }

    .balance-separator {
      font-size: 20px;
      color: var(--ep-text-color-placeholder);
      font-weight: 500;
      flex-shrink: 0;
      padding: 0 8px;
    }

    .difference-badge {
      position: absolute;
      top: -12px;
      right: 20px;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      background: var(--ep-bg-color);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--ep-border-color-lighter);

      &.positive {
        color: var(--ep-color-success);
      }

      &.negative {
        color: var(--ep-color-danger);
      }

      .difference-main {
        font-weight: 600;
      }
    }
  }

  // 差额分配区
  .allocation-section {
    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--ep-text-color-primary);
    }

    .first-reconciliation-alert {
      margin-bottom: 16px;
      width: 100%;
      box-sizing: border-box;

      :deep(.el-alert__content) {
        padding-left: 0;
        padding-right: 0;
        width: 100%;
        text-align: left;
      }

      :deep(.el-alert__title) {
        width: 100%;
      }

      .alert-title-flex {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        font-size: 14px;
        line-height: 1.5;
        text-align: left;

        .alert-text-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
          min-width: 0;

          p {
            margin: 0;
          }
        }

        code {
          background-color: var(--ep-fill-color);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
        }
      }
    }

    .allocation-table {
      margin-bottom: 16px;

      :deep(.el-table__cell) {
        padding: 12px 8px;
      }

      // 操作列样式
      .action-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;

        .date-picker-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
        }
      }
    }

    .allocation-actions {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 12px;
    }

    .validation-errors {
      margin-top: 12px;

      .error {
        color: var(--ep-color-danger);
        margin: 6px 0;
        font-size: 14px;
        line-height: 1.5;
      }
    }
  }

  // 操作按钮区
  .action-section {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--ep-border-color-lighter);
  }

  // 响应式设计
  @media (max-width: 768px) {
    padding: 12px;

    :deep(.el-card) {
      max-width: 100%;
    }

    .balance-comparison {
      flex-direction: column;
      gap: 16px;
      padding: 16px;

      .balance-separator {
        transform: rotate(90deg);
        padding: 8px 0;
      }

      .difference-badge {
        position: static;
        align-self: flex-start;
        margin-top: 8px;
      }
    }

    .card-header {
      .header-content {
        .header-account {
          font-size: 12px;
        }
      }
    }
  }

  // 暗色模式样式
  :deep(html.dark) :deep(.el-card) {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  :deep(html.dark) .balance-comparison {
    background-color: var(--ep-fill-color-darker);
    border-color: var(--ep-border-color);
  }

  :deep(html.dark) .difference-badge {
    background: var(--ep-bg-color);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    border-color: var(--ep-border-color);
  }
}
</style>

<!-- 非 scoped 样式，用于覆盖 Element Plus 日期选择器默认样式（复用 ReconciliationList.vue 的样式） -->
<style lang="scss">
.reconciliation-form .allocation-table .no-border-date-picker {
  width: 140px;

  // 清除所有边框和阴影（同时匹配 el- 和 ep- 命名空间）
  .ep-input__wrapper,
  .el-input__wrapper,
  [class*="input__wrapper"] {
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    border-color: transparent !important;
    box-shadow: none !important;
    outline: none !important;
    outline-width: 0 !important;
    background-color: transparent !important;
    padding: 4px 8px !important;
    transition: all 0.2s;

    &::before,
    &::after {
      display: none !important;
      content: none !important;
      border: none !important;
      border-width: 0 !important;
      box-shadow: none !important;
      background: none !important;
    }

    &:hover {
      background-color: var(--ep-fill-color) !important;
      border: none !important;
      border-width: 0 !important;
      box-shadow: none !important;
      outline: none !important;
    }

    &.is-focus,
    &[class*="is-focus"] {
      background-color: var(--ep-fill-color) !important;
      border: none !important;
      border-width: 0 !important;
      box-shadow: none !important;
      outline: none !important;
    }
  }

  // 清除输入框内部样式
  .ep-input__inner,
  .el-input__inner,
  [class*="input__inner"] {
    font-family: 'Courier New', monospace;
    font-weight: 500;
    font-size: 13px;
    color: var(--ep-text-color-regular);
    text-align: center;
    border: none !important;
    outline: none !important;
    background: transparent !important;
    padding: 0 !important;
  }

  // 移除日期选择器右侧的图标
  .ep-input__suffix,
  .el-input__suffix,
  [class*="input__suffix"] {
    display: none !important;
  }

  // 清除整个输入框容器的边框
  .ep-input,
  .el-input,
  [class*="input"] {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }

  // 清除日期选择器外层容器的所有视觉效果
  .ep-date-editor,
  .el-date-editor,
  [class*="date-editor"] {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    background: transparent !important;

    &::before,
    &::after {
      display: none !important;
      content: none !important;
    }
  }

  // 使用属性选择器匹配所有可能的变体
  [class*="ep-input"],
  [class*="el-input"] {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
}
</style>
