<template>
  <el-upload ref="uploadRef" class="upload-demo" :drag="true" :action="action" method="POST" :data="getUploadData"
    :multiple="false" :headers="headers" accept=".csv,.pdf,.xls,.xlsx,.zip" show-file-list name="trans"
    :disabled="uploading" :before-upload="handleBeforeUpload" @progress="handleUploadProgress"
    @success="handleUploadSuccess" @error="handleUploadError">
    <div class="el-upload__text">
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      拖拽文件至此处 或 <em>单击上传</em>
    </div>
    <p class="upload-privacy-hint">
      该操作不会保存您的任何文件，所有上传的文件均在处理完成后立即删除
    </p>
    <template #tip>
      <div class="el-upload__tip">
        <el-popover placement="top-start" :width="560" trigger="hover">
          <div class="bill-support-panel">
            <div v-for="group in billSupportGroups" :key="group.title" class="bill-support-group">
              <div class="bill-support-group-title">{{ group.title }}</div>
              <div v-for="item in group.bills" :key="item.billType" class="bill-support-row">
                <a v-if="item.href" :href="item.href" :download="item.download || undefined"
                  :target="item.download ? undefined : '_blank'" rel="noopener" class="bill-support-link">
                  {{ item.label }}
                </a>
                <span v-else class="bill-support-name">{{ item.label }}</span>
                <span v-if="billSupportState === 'loading'" class="bill-support-empty">加载中…</span>
                <span v-else-if="billSupportState === 'error'" class="bill-support-empty">暂时无法获取</span>
                <span v-else-if="getBillSupportText(item.billType)" class="bill-support-time">
                  {{ getBillSupportText(item.billType) }}
                </span>
                <span v-else class="bill-support-empty">暂未成功解析</span>
              </div>
            </div>
          </div>
          <template #reference>
            <span class="bill-support-trigger">当前支持微信、支付宝、储蓄卡、信用卡账单</span>
          </template>
        </el-popover>
        <el-select v-model="value4" multiple collapse-tags collapse-tags-tooltip :max-collapse-tags="2"
          placeholder="可选功能" style="width: 300px">
          <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input ref="passwordInputRef" v-model="input" style="width: 250px" type="password" v-if="showPassword"
          placeholder="PDF/ZIP 文件解密密码" show-password>
          <template #prefix>
            <el-icon>
              <Lock />
            </el-icon>
          </template>
        </el-input>
      </div>
      <p v-if="isAuthenticated" class="upload-multi-bill-hint">
        多张账单需要合并去重？
        <router-link to="/file" class="upload-multi-bill-link">前往「文件管理」批量解析</router-link>
      </p>
    </template>
  </el-upload>

  <div v-if="uploading" class="parse-status" role="status" aria-live="polite">
    <div class="parse-status-main">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <span>正在解析 {{ pendingFileName }}…</span>
    </div>
    <span class="parse-status-hint">请勿刷新页面；大文件可能需要数秒</span>
    <el-progress v-if="uploadPercent > 0 && uploadPercent < 100" :percentage="uploadPercent" :show-text="false" />
  </div>

  <div v-if="parseFailure" class="parse-failure" :class="`is-${parseFailure.code.toLowerCase()}`" role="alert"
    aria-live="assertive">
    <div class="parse-failure-title">
      <el-icon>
        <WarningFilled />
      </el-icon>
      {{ parseFailure.title }}
    </div>
    <p class="parse-failure-message">{{ parseFailure.message }}</p>
    <ul v-if="parseFailure.hints.length" class="parse-failure-hints">
      <li v-for="hint in parseFailure.hints" :key="hint">{{ hint }}</li>
    </ul>
    <div class="parse-failure-actions">
      <el-button v-if="isDecryptionFailure" type="primary" @click="focusPasswordInput">
        填写密码
      </el-button>
      <el-button @click="openFilePicker">重新选择文件</el-button>
      <el-button v-if="parseFailure.suggestNoIgnore" link @click="retryWithNoIgnore">
        关闭默认忽略后重试
      </el-button>
      <el-button v-if="parseFailure.showBillGuides" link @click="openBillExportDocs">
        查看账单导出教程
      </el-button>
    </div>
    <div v-if="parseFailure.showBillGuides" class="parse-failure-guides">
      示例账单：
      <a :href="wechatUrl" download>微信</a>
      <a :href="alipayUrl" download>支付宝</a>
    </div>
  </div>

  <div v-if="hasEntries" class="result-toolbar">
    <el-button v-if="reviewMode === 'advanced'" @click="handlePreview">
      预览
    </el-button>
    <el-button v-if="isAuthenticated" type="primary" :icon="DocumentChecked" @click="handleWriteCollect"
      :loading="writing">
      写入账本
    </el-button>
    <ReviewModeSwitch class="toolbar-mode-switch" />
  </div>

  <CapabilityNotice v-if="hasEntries && !isAuthenticated" class="anonymous-result-guide" capability="ledger.write"
    description="登录后自动补齐银行卡、信用卡等账户，减少记到「Other 账户」，同时写入你的自有账本并生成本期消费月报。" :before-action="preserveGuestParse" />

  <el-input v-if="!hasEntries && !uploading && !parseFailure" class="result-textarea" type="textarea" :rows="30"
    readonly :value="''" :placeholder="emptyResultPlaceholder" />

  <div v-else class="table-container">
    <ParseEntryTable :entries="formattedEntries" :error-entries="errorEntries" :validation-warnings="validationWarnings"
      :mode="reviewMode" :on-reparse="handleTableReparse" :on-persist-edit="handlePersistEdit"
      :on-patch-tags="handlePatchTags" :on-remove-entry="handleRemoveEntry" :require-auth="() => can('ledger.write')" />
  </div>

  <el-dialog v-model="showPreviewDialog" title="预览所有条目" width="80%">
    <el-input v-model="previewContent" type="textarea" :rows="20" class="preview-textarea"
      placeholder="可以在此处编辑所有条目，编辑后点击保存按钮将更新到列表中" />
    <template #footer>
      <div class="preview-footer">
        <el-button type="success" :icon="DocumentCopy" class="preview-copy" @click="copyPreviewContent">
          复制结果
        </el-button>
        <el-button @click="showPreviewDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSavePreview" :loading="savingPreview">
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, ElPopover } from 'element-plus'
import type { InputInstance } from 'element-plus'
import { UploadFilled, DocumentCopy, DocumentChecked, Lock, Loading, WarningFilled } from '@element-plus/icons-vue'
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../../utils/request'
import { getAccessToken } from '../../utils/auth'
import ParseEntryTable from '../parse/ParseEntryTable.vue'
import ReviewModeSwitch from '../parse/ReviewModeSwitch.vue'
import CapabilityNotice from '../common/CapabilityNotice.vue'
import { useCapabilities } from '../../capabilities'
import { useReviewMode } from '../../composables/useReviewMode'
import { BILLS_EXPORT_DOCS_URL } from '../../utils/userTour'
import {
  alignPreviewBlocksToEntries,
  parsePreviewContent
} from '../../utils/parse-review-preview'
import { applyTagOverridesToHeader } from '../../utils/beancount-header-tags'
import { writeCollectEntries, getBillSupportStatus } from '../../api/translate'
import { getAssistantStatus } from '../../api/assistant'
import {
  buildFirstReportPrompt,
  clearGuestWriteIntent,
  deriveEntriesPeriod,
  hasGuestWriteIntent,
  markGuestWriteIntent,
  setPendingFirstReport
} from '../../composables/useFirstReport'
import {
  clearParseDraft,
  loadParseDraft,
  saveParseDraft
} from '../../composables/useParseDraft'
import {
  savePendingParseFile,
  takePendingParseFile
} from '../../composables/usePendingParseFile'
import type { FormattedEntry, TagDetail, OriginalRow } from '../../types/parse-review'
import type { BillSupportItem } from '../../types/translate'

const router = useRouter()
const { mode: reviewMode } = useReviewMode()

const input = ref()
const wechatUrl = ref('https://dl.dhr2333.cn/%E5%AE%8C%E6%95%B4%E6%B5%8B%E8%AF%95_%E5%BE%AE%E4%BF%A1.csv')
const alipayUrl = ref('https://dl.dhr2333.cn/%E5%AE%8C%E6%95%B4%E6%B5%8B%E8%AF%95_%E6%94%AF%E4%BB%98%E5%AE%9D.csv')
const bocDebitBillGuideUrl = `${BILLS_EXPORT_DOCS_URL}#%E4%B8%AD%E5%9B%BD%E9%93%B6%E8%A1%8Cboc%E5%82%A8%E8%93%84debit%E5%8D%A1`
const cmbCreditBillGuideUrl = `${BILLS_EXPORT_DOCS_URL}#%E6%8B%9B%E5%95%86%E9%93%B6%E8%A1%8Ccmb%E4%BF%A1%E7%94%A8credit%E5%8D%A1`
const value4 = ref<string[]>([])
const options = [
  {
    value: '使用平台 LLM',
    label: '使用 LLM（提高准确率但更慢）',
  },
  {
    value: '文件若加密请选择',
    label: '文件已加密（PDF/ZIP 需密码）',
  },
  {
    value: '关闭默认忽略',
    label: '关闭默认忽略',
  },
  {
    value: '中国银行借记卡忽略支付宝微信条目',
    label: '中国银行借记卡忽略支付宝微信条目',
  },
  {
    value: '招行信用卡忽略支付宝微信条目',
    label: '招行信用卡忽略支付宝微信条目',
  }
]

const csrfToken = ref('')
const action = axios.defaults.baseURL + '/translate/trans'

/** 账单解析可用性悬浮框：分组与展示顺序由前端维护，后端只返回类型码与时间 */
interface BillSupportGroup {
  title: string
  bills: Array<{ billType: string; label: string; href?: string; download?: boolean }>
}

const billSupportGroups: BillSupportGroup[] = [
  {
    title: '支付平台',
    bills: [
      { billType: 'wechat', label: '微信', href: wechatUrl.value, download: true },
      { billType: 'alipay', label: '支付宝', href: alipayUrl.value, download: true }
    ]
  },
  {
    title: '储蓄卡',
    bills: [
      { billType: 'ICBC_Debit', label: '中国工商银行储蓄卡（ICBC）' },
      { billType: 'CCB_Debit', label: '中国建设银行储蓄卡（CCB）' },
      { billType: 'BOC_Debit', label: '中国银行储蓄卡（BOC）', href: bocDebitBillGuideUrl }
    ]
  },
  {
    title: '信用卡',
    bills: [
      { billType: 'CMB_Credit', label: '招商银行信用卡（CMB）', href: cmbCreditBillGuideUrl }
    ]
  }
]

const billSupportByType = ref<Record<string, BillSupportItem>>({})
const billSupportState = ref<'loading' | 'ready' | 'error'>('loading')

async function loadBillSupport() {
  billSupportState.value = 'loading'
  try {
    const { data } = await getBillSupportStatus()
    const supportMap: Record<string, BillSupportItem> = {}
    for (const item of data.bills ?? []) {
      supportMap[item.bill_type] = item
    }
    billSupportByType.value = supportMap
    billSupportState.value = 'ready'
  } catch {
    billSupportState.value = 'error'
  }
}

function formatBillDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getBillSupportText(billType: string): string {
  const item = billSupportByType.value[billType]
  if (!item?.last_success_at) return ''
  const text = `最近成功：${formatBillDateTime(item.last_success_at)}`
  return item.latest_bill_date ? `${text} · 账单最新：${item.latest_bill_date}` : text
}

const isWrite = ref(false)
const cmbCreditIgnore = ref(false)
const bocDebitIgnore = ref(false)
const noIgnore = ref(false)
const showPassword = ref(false)
/** 是否按次使用平台 LLM；不勾选时按用户配置（默认本地 BERT） */
const usePlatformLlm = ref(false)

/** 上传/解析状态与失败原因（错误账单、加密账单的就地引导） */
type ParseFailureCode =
  | 'DECRYPTION_REQUIRED'
  | 'DECRYPTION_FAILED'
  | 'UNSUPPORTED_BILL'
  | 'EMPTY_RESULT'
  | 'PARSE_FAILED'
  | 'NETWORK_ERROR'

interface ParseFailure {
  code: ParseFailureCode
  title: string
  message: string
  hints: string[]
  /** 展示「关闭默认忽略后重试」按钮 */
  suggestNoIgnore?: boolean
  /** 展示示例账单 / 导出教程入口 */
  showBillGuides?: boolean
}

interface ParseDiagnostics {
  total_rows?: number
  prefiltered_rows?: number
  filtered_rows?: number
}

const uploadRef = ref<any>()
const passwordInputRef = ref<InputInstance>()
/** 当前选中的账单文件，未登录时登录成功后会用它自动重新解析 */
const pendingFile = ref<File | null>(null)
const { can, hasGit, refresh } = useCapabilities()
const isAuthenticated = computed(() => can('ledger.write'))
const uploading = ref(false)
const uploadPercent = ref(0)
const pendingFileName = ref('')
const parseFailure = ref<ParseFailure | null>(null)
const isDecryptionFailure = computed(
  () =>
    parseFailure.value?.code === 'DECRYPTION_REQUIRED' ||
    parseFailure.value?.code === 'DECRYPTION_FAILED'
)
const SUPPORTED_EXTENSIONS = ['csv', 'pdf', 'xls', 'xlsx', 'zip']

type LocalFormattedEntry = FormattedEntry & {
  /** 最近一次解析/重解析返回的标签明细（不含本地 manual 覆盖） */
  _source_tag_details?: TagDetail[]
}

const formattedEntries = ref<LocalFormattedEntry[]>([])
const errorEntries = ref<Record<string, string>>({})
const validationWarnings = ref<Record<string, string>>({})
const showPreviewDialog = ref(false)
const previewContent = ref('')
const savingPreview = ref(false)
/** 写入账本中（写入期间禁用按钮，避免重复追加） */
const writing = ref(false)

const hasEntries = computed(() => formattedEntries.value.length > 0)

const emptyResultPlaceholder = computed(() =>
  reviewMode.value === 'simple'
    ? '上传支付宝 / 微信 / 银行账单后，这里会显示可核对的收支记录。\n\n直接点选分类、账户和标签即可；日期、商户等参考信息收在「更多信息」里，不需要了解 Beancount。'
    : '解析结果如下：\n\n2022-06-19 * "温州市数据管理发展集团有限公司" "HIK-停车缴费-洞头人民路停车场(人民路区域共享)"\n    time: "15:27:44"\n    uuid: "2022061922001474561419808812"\n    status: "ALiPay - 交易成功"\n    Expenses:TransPort:Private:Park +5.00 CNY\n    Liabilities:CreditCard:Bank:CITIC:C6428 -5.00 CNY\n'
)

const joinedEditedText = computed(() =>
  formattedEntries.value
    .map((entry) => (entry.edited_formatted || entry.formatted || '').replace(/\n+$/, ''))
    .filter((text) => text.trim())
    .join('\n\n')
)

const getUploadData = () => {
  return {
    cmb_credit_ignore: cmbCreditIgnore.value,
    boc_debit_ignore: bocDebitIgnore.value,
    no_ignore: noIgnore.value,
    write: isWrite.value,
    password: input.value,
    csrfmiddlewaretoken: csrfToken.value,
    ...(usePlatformLlm.value ? { parse_engine: 'Platform' } : {}),
  }
}

watch(value4, (newValue) => {
  isWrite.value = newValue.includes('写入Beancount-Trans-Assets')
  cmbCreditIgnore.value = newValue.includes('招行信用卡忽略支付宝微信条目')
  bocDebitIgnore.value = newValue.includes('中国银行借记卡忽略支付宝微信条目')
  noIgnore.value = newValue.includes('关闭默认忽略')
  showPassword.value = newValue.includes('文件若加密请选择')
  usePlatformLlm.value = newValue.includes('使用平台 LLM')
})

axios.defaults.withCredentials = true

const headers = computed(() => {
  const token = getAccessToken()
  return {
    'X-CSRFToken': csrfToken.value,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
})

function normalizeOriginalRow(item: Record<string, any>): OriginalRow {
  const fromApi = (item.original_row && typeof item.original_row === 'object')
    ? item.original_row
    : {}
  return {
    transaction_time: fromApi.transaction_time || '',
    transaction_category: fromApi.transaction_category || '',
    counterparty: fromApi.counterparty || item.counterparty || '',
    commodity: fromApi.commodity || item.commodity || '',
    transaction_type: fromApi.transaction_type || item.transaction_type || '',
    amount: fromApi.amount ?? '',
    payment_method: fromApi.payment_method || item.payment_method || '',
    transaction_status: fromApi.transaction_status,
    bill_identifier: fromApi.bill_identifier,
    ...fromApi
  }
}

function toFormattedEntry(item: Record<string, any>): LocalFormattedEntry {
  const candidates = Array.isArray(item.ai_candidates)
    ? item.ai_candidates
    : (Array.isArray(item.expense_candidates_with_score) ? item.expense_candidates_with_score : [])
  const firstCandidate = candidates[0]?.key || ''
  const formatted = (item.formatted || '').replace(/\n+$/, '')
  const edited = (item.edited_formatted || formatted).replace(/\n+$/, '')
  const uuid = String(item.uuid || item.id || '')
  const tagDetails: TagDetail[] = Array.isArray(item.tag_details) ? item.tag_details : []
  const overrides = item.tag_overrides ?? { removed_paths: [], added_paths: [] }
  const sourceDetails: TagDetail[] = Array.isArray(item._source_tag_details)
    ? item._source_tag_details
    : tagDetails

  return {
    uuid,
    formatted,
    edited_formatted: edited,
    selected_expense_key: item.selected_expense_key || item.ai_choose || firstCandidate || '',
    expense_candidates_with_score: candidates.map((c: { key: string; score?: number }) => ({
      key: c.key,
      score: c.score ?? 0
    })),
    original_row: normalizeOriginalRow(item),
    tag_details: tagDetails,
    tag_overrides: overrides,
    installment_role: item.installment_role ?? null,
    installment_period: item.installment_period ?? null,
    _source_tag_details: sourceDetails
  }
}

/** 按 tag_overrides 计算有效 tag_details（与首行展示一致） */
function effectiveTagDetails(
  baseDetails: TagDetail[],
  overrides?: FormattedEntry['tag_overrides']
): TagDetail[] {
  const removed = new Set((overrides?.removed_paths ?? []).map((p) => p.toLowerCase()))
  const effective: TagDetail[] = (baseDetails ?? []).filter(
    (d) => d.path && !removed.has(d.path.toLowerCase())
  )
  const existing = new Set(effective.map((d) => d.path.toLowerCase()))
  for (const added of overrides?.added_paths ?? []) {
    if (!added || existing.has(added.toLowerCase())) continue
    effective.push({ path: added, sources: [{ type: 'manual' }] })
    existing.add(added.toLowerCase())
  }
  return effective
}

/** 重解析后保留本地标签覆盖，并同步首行与 tag_details */
function applyLocalTagOverrides(entry: LocalFormattedEntry): LocalFormattedEntry {
  const overrides = entry.tag_overrides ?? { removed_paths: [], added_paths: [] }
  const sourceDetails = entry._source_tag_details ?? entry.tag_details ?? []
  const hasOverrides =
    (overrides.removed_paths?.length ?? 0) > 0 || (overrides.added_paths?.length ?? 0) > 0
  if (!hasOverrides) {
    return {
      ...entry,
      _source_tag_details: sourceDetails,
      tag_details: sourceDetails
    }
  }

  const details = effectiveTagDetails(sourceDetails, overrides)
  // 保留手改账户：以当前 edited 为底只改首行标签
  const edited = applyTagOverridesToHeader(
    entry.edited_formatted || entry.formatted,
    sourceDetails,
    overrides
  )
  return {
    ...entry,
    _source_tag_details: sourceDetails,
    tag_details: details,
    edited_formatted: edited.replace(/\n+$/, '')
  }
}

function buildFailure(
  code: ParseFailureCode,
  options: { detail?: string; diagnostics?: ParseDiagnostics } = {}
): ParseFailure {
  const detail = (options.detail || '').trim()
  const diagnostics = options.diagnostics

  switch (code) {
    case 'DECRYPTION_REQUIRED':
      return {
        code,
        title: '该账单文件已加密',
        message: '已为你勾选「文件已加密」并展开密码输入框。填写打开密码后，重新选择该文件上传。',
        hints: [
          '常见密码：身份证后 6 位、手机号后 6 位或银行预留密码',
          '若文件本身没有密码，可能是文件已损坏，请重新导出后再试',
        ],
      }
    case 'DECRYPTION_FAILED':
      return {
        code,
        title: '密码不正确或文件已损坏',
        message: detail || '请确认解密密码后重新上传。',
        hints: ['可先在本地打开文件，确认能否正常查看', 'ZIP 可解压后单独上传内部账单'],
      }
    case 'UNSUPPORTED_BILL':
      return {
        code,
        title: '暂不支持该账单类型',
        message: '请确认上传的是银行或支付平台导出的原始账单文件，而不是截图、回单或自制表格。',
        hints: [
          '目前支持：微信、支付宝、工行/建行/中行储蓄卡、招行信用卡账单',
          '请按官方导出方式重新导出，或下载示例账单核对格式',
        ],
        showBillGuides: true,
      }
    case 'EMPTY_RESULT': {
      const filteredOut =
        (diagnostics?.prefiltered_rows ?? 0) > 0 && (diagnostics?.filtered_rows ?? 0) === 0
      if (filteredOut) {
        return {
          code,
          title: '未生成条目：交易被默认规则过滤',
          message: `账单共 ${diagnostics?.total_rows ?? 0} 条，过滤后 0 条。`,
          hints: ['如需保留交易关闭、退款等条目，勾选「关闭默认忽略」后重新上传'],
          suggestNoIgnore: true,
        }
      }
      return {
        code,
        title: '未从账单中识别到交易',
        message: diagnostics
          ? `账单共 ${diagnostics.total_rows ?? 0} 条，过滤后 ${diagnostics.filtered_rows ?? 0} 条。`
          : '未能从该文件中解析出任何交易。',
        hints: ['请确认导出的是原始账单文件，未修改表头或另存为其他格式', '可下载示例账单对照格式'],
        showBillGuides: true,
      }
    }
    case 'NETWORK_ERROR':
      return {
        code,
        title: '上传失败',
        message: '网络连接异常，请检查网络后重试。',
        hints: ['上传的文件不会被保存，处理完成后会立即删除'],
      }
    default:
      return {
        code: 'PARSE_FAILED',
        title: '解析失败',
        message: detail || '请确认文件可以正常打开后重试。',
        hints: ['若持续失败，请换用 CSV / PDF 原始导出文件'],
      }
  }
}

/** 勾选「文件已加密」选项，用于失败后就地展开密码框 */
function ensurePasswordOption() {
  if (!value4.value.includes('文件若加密请选择')) {
    value4.value = [...value4.value, '文件若加密请选择']
  }
}

function focusPasswordInput() {
  ensurePasswordOption()
  nextTick(() => {
    passwordInputRef.value?.focus()
    const el = passwordInputRef.value?.$el as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

/** 打开文件选择器，让用户重新选择文件（不保留上一次文件） */
function openFilePicker() {
  const root = uploadRef.value?.$el as HTMLElement | undefined
  const trigger = root?.querySelector<HTMLElement>('.el-upload')
  if (trigger) {
    trigger.click()
  } else {
    ElMessage.info('请点击上方上传区域重新选择文件')
  }
}

function openBillExportDocs() {
  window.open(BILLS_EXPORT_DOCS_URL, '_blank', 'noopener')
}

function retryWithNoIgnore() {
  if (!value4.value.includes('关闭默认忽略')) {
    value4.value = [...value4.value, '关闭默认忽略']
  }
  openFilePicker()
}

const applyFailure = (failure: ParseFailure) => {
  parseFailure.value = failure
}

const handleBeforeUpload = (file: File) => {
  const extension = (file?.name || '').split('.').pop()?.toLowerCase() || ''
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    ElMessage.error('仅支持 CSV / Excel / PDF / ZIP 账单文件')
    return false
  }
  if (!file.size) {
    ElMessage.error('文件为空，请重新导出账单后上传')
    return false
  }

  uploading.value = true
  uploadPercent.value = 0
  pendingFileName.value = file.name
  pendingFile.value = file
  parseFailure.value = null
  // 新文件开始解析即清空旧结果，避免把上一次结果误写入账本
  formattedEntries.value = []
  errorEntries.value = {}
  validationWarnings.value = {}
  clearParseDraft()
  return true
}

const handleUploadProgress = (evt: { percent?: number }) => {
  uploadPercent.value = Math.round(evt?.percent || 0)
}

const handleUploadSuccess = async (response: any, file: any) => {
  uploading.value = false
  uploadPercent.value = 100
  if (file.status === 'error') return

  if (response?.status === 'error') {
    applyFailure(
      buildFailure(response?.error_code || 'PARSE_FAILED', { detail: response?.error })
    )
    return
  }

  const normalized: FormattedEntry[] = Array.isArray(response.results)
    ? response.results.map((item: Record<string, any>) => toFormattedEntry(item))
    : []

  if (normalized.length === 0) {
    formattedEntries.value = []
    errorEntries.value = {}
    validationWarnings.value = {}
    clearParseDraft()
    applyFailure(buildFailure('EMPTY_RESULT', { diagnostics: response?.diagnostics }))
    return
  }

  formattedEntries.value = normalized
  errorEntries.value = {}
  validationWarnings.value = {}
  parseFailure.value = null
  // 新解析结果取代旧结果，清掉可能存在的登录前草稿
  clearParseDraft()

  // 游客登录回跳后的重解析：提示本次结果已按本人账户配置生成
  if (isAuthenticated.value && hasGuestWriteIntent()) {
    const track = await resolvePostLoginTrack()
    ElMessage.info(
      track === 'ledger'
        ? '已按你的账本配置重新解析，缺失账户已自动补齐；确认后可写入。'
        : '已用你的账户重新解析；确认写入后即可生成本期月报。'
    )
  }
}

const handleUploadError = (err: any, _file: any) => {
  uploading.value = false

  let payload: any = null
  try {
    payload = JSON.parse(err?.message || '')
  } catch {
    payload = null
  }
  const detail: string = payload?.error || payload?.message || ''
  let code = payload?.error_code as ParseFailureCode | undefined

  // 兼容旧后端：没有 error_code 时按状态码与文案回退
  if (!code) {
    if (err?.status === 415) {
      code = 'UNSUPPORTED_BILL'
    } else if (detail.includes('请提供解密密码')) {
      code = 'DECRYPTION_REQUIRED'
    } else if (detail.includes('解密失败')) {
      code = 'DECRYPTION_FAILED'
    } else if (err?.status === 0) {
      code = 'NETWORK_ERROR'
    } else {
      code = 'PARSE_FAILED'
    }
  }

  applyFailure(buildFailure(code, { detail }))

  if (code === 'DECRYPTION_REQUIRED' || code === 'DECRYPTION_FAILED') {
    ensurePasswordOption()
  }
  if (code === 'DECRYPTION_REQUIRED') {
    ElMessage.warning('该文件已加密，请输入密码后重新上传')
  }
}

/** 预览弹窗内复制：复制当前预览文本（含未保存的修改） */
const copyPreviewContent = async () => {
  try {
    await navigator.clipboard.writeText(previewContent.value)
    // 复制即视为结果已导出，清掉登录前草稿，刷新后不再恢复
    clearParseDraft()
    ElMessage.success('复制成功')
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动选择内容复制')
  }
}

/** 挂载时：已登录且存在待重解析文件则自动重解析；否则恢复解析草稿 */
onMounted(async () => {
  loadBillSupport()

  if (isAuthenticated.value) {
    const resumed = await takePendingParseFile()
    if (resumed) {
      ElMessage.info('正在使用你的账户配置重新解析刚才的账单')
      uploadRef.value?.handleStart(resumed)
      await nextTick()
      uploadRef.value?.submit()
      return
    }
  }

  const draft = loadParseDraft()
  if (!draft || formattedEntries.value.length > 0) return
  formattedEntries.value = draft.entries
  ElMessage.info(
    '已恢复上次未写入的解析结果'
  )
})

/** 登录后按账本形态分流：已绑定 Git 账本的存量用户走账户补齐，其余走首期月报 */
async function resolvePostLoginTrack(): Promise<'report' | 'ledger'> {
  await refresh()
  return hasGit.value ? 'ledger' : 'report'
}

/** 登录前暂存当前文件、结果与写入意图，登录成功后回跳 /trans 自动重新解析 */
const preserveGuestParse = async () => {
  if (pendingFile.value) {
    await savePendingParseFile(pendingFile.value)
  }
  saveParseDraft(formattedEntries.value)
  markGuestWriteIntent()
}

/** Copilot 不可用时给出配置指引，不影响已完成的写入 */
async function promptToConfigureCopilot(entryCount: number): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `账单已写入账本（${entryCount} 条）。配置接口地址、模型与密钥后，可基于账本生成月报。`,
      '生成月报需要先配置 Copilot',
      { confirmButtonText: '去配置', cancelButtonText: '稍后', type: 'info' }
    )
    router.push('/format')
  } catch {
    // 用户选择稍后
  }
}

/** 写入成功后进入 Copilot，由助手页自动发送首期提问 */
async function openFirstReport(prompt: string, entryCount: number): Promise<void> {
  try {
    const { data } = await getAssistantStatus()
    const canUseAssistant =
      data.api_key_configured && (data.ledger_exists || Boolean(data.has_usable_shared_ledger))
    if (!canUseAssistant) {
      await promptToConfigureCopilot(entryCount)
      return
    }
    setPendingFirstReport(prompt)
    ElMessage.info('正在为你生成本期月报…')
    router.push('/assistant')
  } catch {
    await promptToConfigureCopilot(entryCount)
  }
}

/**
 * 写入账本：把当前结果校验后追加写入 trans/collect.bean。
 * 仅登录用户可见；未登录用户走结果页的登录提示条。
 */
const handleWriteCollect = async () => {
  if (!hasEntries.value || writing.value) return

  try {
    await ElMessageBox.confirm(
      `将把解析结果（共 ${formattedEntries.value.length} 条）追加写入 trans/collect.bean`,
      '确认写入账本',
      { confirmButtonText: '写入', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  writing.value = true
  try {
    // 仅游客链路需要：写入前先算好账单周期与首期提问
    const isGuestFirstWrite = hasGuestWriteIntent()
    const period = isGuestFirstWrite ? deriveEntriesPeriod(formattedEntries.value) : null
    const prompt = isGuestFirstWrite ? buildFirstReportPrompt(period) : null

    const { data } = await writeCollectEntries(
      formattedEntries.value.map((entry) => ({
        uuid: entry.uuid,
        directive: (entry.edited_formatted || entry.formatted || '').replace(/\n+$/, '')
      }))
    )
    ElMessage.success(`已写入 trans/collect.bean（${data.entry_count} 条）`)
    // 写入是追加语义：清空结果表，从根上避免重复点击重复入账
    formattedEntries.value = []
    errorEntries.value = {}
    validationWarnings.value = {}
    showPreviewDialog.value = false
    previewContent.value = ''
    clearParseDraft()

    // 已登录用户的日常写入到此结束，不进入月报链路
    if (!isGuestFirstWrite) return
    clearGuestWriteIntent()

    const track = await resolvePostLoginTrack()
    if (track === 'ledger' || !prompt) {
      ElMessage.info('已按你的账本配置自动补齐缺失账户；可在「设置 → 高级：本地账本」同步到 Git 账本。')
      return
    }
    await openFirstReport(prompt, data.entry_count)
  } catch (error: any) {
    const payload = error?.response?.data
    const failedEntries = Array.isArray(payload?.error_entries) ? payload.error_entries : []
    if (failedEntries.length > 0) {
      // 语法错误：不写入任何条目，按 uuid 定位到表格中的错误行
      const nextErrors: Record<string, string> = { ...errorEntries.value }
      failedEntries.forEach((item: { uuid?: string; error_message?: string }) => {
        if (item?.uuid) nextErrors[item.uuid] = item.error_message || '格式有误'
      })
      errorEntries.value = nextErrors
      ElMessage.error(payload?.error || '存在语法错误，未写入任何条目')
    } else {
      ElMessage.error(payload?.error || payload?.detail || '写入失败，请重试')
    }
  } finally {
    writing.value = false
  }
}

const handlePreview = () => {
  previewContent.value = joinedEditedText.value
  showPreviewDialog.value = true
}

const handleSavePreview = async () => {
  if (!previewContent.value.trim()) {
    ElMessage.warning('预览内容不能为空')
    return
  }

  savingPreview.value = true
  try {
    const blocks = parsePreviewContent(previewContent.value)
    const { kept, removedCount } = alignPreviewBlocksToEntries(
      blocks,
      formattedEntries.value.map((entry) => ({
        uuid: entry.uuid,
        edited_formatted: entry.edited_formatted
      }))
    )

    if (kept.length === 0) {
      ElMessage.warning('预览内容无有效条目')
      return
    }

    const keptMap = new Map(kept.map((item) => [item.uuid, item.edited_formatted]))
    formattedEntries.value = formattedEntries.value
      .filter((entry) => keptMap.has(entry.uuid))
      .map((entry) => ({
        ...entry,
        edited_formatted: (keptMap.get(entry.uuid) || entry.edited_formatted).replace(/\n+$/, '')
      }))

    // 校验更新后的条目
    validationWarnings.value = {}
    await Promise.all(
      formattedEntries.value.map(async (entry) => {
        try {
          const response = await axios.post('/translate/validate-entry', {
            edited_formatted: entry.edited_formatted
          })
          if (response.data?.validation_warning) {
            validationWarnings.value[entry.uuid] = response.data.validation_warning
          }
        } catch {
          // 校验失败不阻断本地保存
        }
      })
    )

    showPreviewDialog.value = false
    if (removedCount > 0) {
      ElMessage.success(`已保存预览，移除 ${removedCount} 条`)
    } else {
      ElMessage.success('预览已保存')
    }
  } finally {
    savingPreview.value = false
  }
}

/**
 * 表格关键字反馈 / 映射保存后的重解析。
 * 成功不弹 toast（映射对话框会提示「重解析完成」）；失败向上抛出由调用方提示，避免重复 toast。
 */
const handleTableReparse = async (
  uuid: string,
  selectedKey: string,
  mappingType?: 'expense' | 'income' | 'asset'
) => {
  const index = formattedEntries.value.findIndex((e) => e.uuid === uuid)
  if (index < 0) {
    throw new Error('条目不存在')
  }
  const entry = formattedEntries.value[index]
  // entry.uuid 即 cache_key / 上传返回的 id
  const entryId = entry.uuid

  const response = await axios.post('/translate/reparse', {
    entry_id: entryId,
    selected_key: selectedKey,
    ...(mappingType ? { mapping_type: mappingType } : {})
  })
  const updated = response.data
  const previousKey = entry.selected_expense_key
  const sourceDetails: TagDetail[] = Array.isArray(updated.tag_details) ? updated.tag_details : []
  let next = toFormattedEntry({
    ...updated,
    id: entryId,
    uuid: entryId,
    ai_choose:
      mappingType === 'asset'
        ? (updated.ai_choose ?? previousKey ?? '')
        : (updated.ai_choose || selectedKey),
    tag_overrides: entry.tag_overrides,
    _source_tag_details: sourceDetails,
    // 先写入源明细，再由 applyLocalTagOverrides 生成有效明细
    tag_details: sourceDetails
  })
  // 重解析后底稿已变：先用新 formatted 作为 edited，再套本地标签覆盖
  next = {
    ...next,
    edited_formatted: (next.formatted || '').replace(/\n+$/, '')
  }
  next = applyLocalTagOverrides(next)
  formattedEntries.value[index] = next
  if (validationWarnings.value[uuid]) {
    const { [uuid]: _removed, ...rest } = validationWarnings.value
    validationWarnings.value = rest
  }
  if (errorEntries.value[uuid]) {
    const { [uuid]: _removed, ...rest } = errorEntries.value
    errorEntries.value = rest
  }
}

const handlePersistEdit = async (
  uuid: string,
  editedFormatted: string,
  options?: { silent?: boolean }
) => {
  const index = formattedEntries.value.findIndex((e) => e.uuid === uuid)
  if (index < 0) return

  const normalized = editedFormatted.replace(/\n+$/, '')
  formattedEntries.value[index] = {
    ...formattedEntries.value[index],
    edited_formatted: normalized
  }

  if (errorEntries.value[uuid]) {
    delete errorEntries.value[uuid]
  }

  try {
    const response = await axios.post('/translate/validate-entry', {
      edited_formatted: normalized
    })
    if (response.data?.validation_warning) {
      validationWarnings.value[uuid] = response.data.validation_warning
    } else {
      delete validationWarnings.value[uuid]
    }
    if (!options?.silent) {
      ElMessage.success('编辑内容已保存')
    }
    return {
      validation_warning: response.data?.validation_warning as string | undefined
    }
  } catch (error: any) {
    if (!options?.silent) {
      ElMessage.error(error.response?.data?.error || '校验失败')
    }
    return
  }
}

const handlePatchTags = async (
  uuid: string,
  payload: { action: 'add' | 'remove'; tag_path: string }
) => {
  const index = formattedEntries.value.findIndex((e) => e.uuid === uuid)
  if (index < 0) {
    throw new Error('条目不存在')
  }
  const entry = formattedEntries.value[index]
  const overrides = {
    removed_paths: [...(entry.tag_overrides?.removed_paths ?? [])],
    added_paths: [...(entry.tag_overrides?.added_paths ?? [])]
  }
  const path = payload.tag_path
  const pathLower = path.toLowerCase()

  if (payload.action === 'add') {
    overrides.removed_paths = overrides.removed_paths.filter((p) => p.toLowerCase() !== pathLower)
    if (!overrides.added_paths.some((p) => p.toLowerCase() === pathLower)) {
      overrides.added_paths.push(path)
    }
  } else {
    overrides.added_paths = overrides.added_paths.filter((p) => p.toLowerCase() !== pathLower)
    if (!overrides.removed_paths.some((p) => p.toLowerCase() === pathLower)) {
      overrides.removed_paths.push(path)
    }
  }

  const sourceDetails = entry._source_tag_details ?? entry.tag_details ?? []
  // 保留账户等手改：以当前 edited 为底只替换首行标签
  const edited = applyTagOverridesToHeader(
    entry.edited_formatted || entry.formatted,
    sourceDetails,
    overrides
  ).replace(/\n+$/, '')
  const effectiveDetails = effectiveTagDetails(sourceDetails, overrides)

  formattedEntries.value[index] = {
    ...entry,
    _source_tag_details: sourceDetails,
    edited_formatted: edited,
    tag_details: effectiveDetails,
    tag_overrides: overrides
  }

  return {
    edited_formatted: edited,
    tag_details: effectiveDetails,
    tag_overrides: overrides
  }
}

const handleRemoveEntry = async (uuid: string) => {
  formattedEntries.value = formattedEntries.value.filter((e) => e.uuid !== uuid)
  delete validationWarnings.value[uuid]
  delete errorEntries.value[uuid]
  ElMessage.success('已排除该条目，不会写入账本')
}
</script>

<style>
.upload-demo,
.result-toolbar,
.result-textarea {
  width: calc(100% - 24px);
  margin-left: 5px;
}

.upload-demo {
  margin-left: 14px;
}

/* .el-textarea 自带 width:100%，与上面的 calc 同权重时会覆盖它，右侧溢出并撑出整页横向滚动 */
.result-textarea.el-textarea {
  width: calc(100% - 24px);
}

/* 示例框高度跟随视口，避免空间足够时仍需纵向滚动 */
.result-textarea .el-textarea__inner {
  height: clamp(220px, calc(100vh - 350px), 550px);
}

.upload-privacy-hint {
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
  margin: 6px 0 0;
}

.upload-multi-bill-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin: 6px 0 0;
}

.upload-multi-bill-link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.bill-support-trigger {
  margin-right: 12px;
  border-bottom: 1px dashed var(--el-border-color);
}

.bill-support-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
  line-height: 1.6;
}

.bill-support-group-title {
  margin-bottom: 2px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.bill-support-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  white-space: nowrap;
}

.bill-support-link,
.bill-support-name {
  flex: 0 0 auto;
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

.bill-support-link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.bill-support-time {
  white-space: nowrap;
  color: var(--el-text-color-secondary);
  text-align: right;
}

.bill-support-empty {
  white-space: nowrap;
  color: var(--el-text-color-placeholder);
}

.parse-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 14px 0;
  padding: 10px 12px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--el-border-radius-base);
  background-color: var(--el-color-primary-light-9);
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-align: left;
}

.parse-status-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.parse-status-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.parse-failure {
  margin: 12px 14px 0;
  padding: 12px 14px;
  border: 1px solid var(--el-color-warning-light-5);
  border-left: 3px solid var(--el-color-warning);
  border-radius: var(--el-border-radius-base);
  background-color: var(--el-color-warning-light-9);
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-align: left;
}

.parse-failure.is-decryption_required,
.parse-failure.is-decryption_failed {
  border-color: var(--el-color-warning-light-5);
  border-left-color: var(--el-color-warning);
  background-color: var(--el-color-warning-light-9);
}

.parse-failure.is-unsupported_bill,
.parse-failure.is-parse_failed,
.parse-failure.is-network_error {
  border-color: var(--el-color-danger-light-5);
  border-left-color: var(--el-color-danger);
  background-color: var(--el-color-danger-light-9);
}

.parse-failure.is-empty_result {
  border-color: var(--el-color-info-light-5);
  border-left-color: var(--el-color-info);
  background-color: var(--el-color-info-light-9);
}

.parse-failure-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.parse-failure-message {
  margin: 8px 0 0;
  line-height: 1.6;
}

.parse-failure-hints {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.parse-failure-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 10px;
}

.parse-failure-guides {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.parse-failure-guides a {
  margin-left: 4px;
  color: var(--el-color-primary);
}

.result-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  /* 与上传卡片左边距一致，避免首个按钮超出卡片边界 */
  margin-left: 14px;
  margin-top: 16px;
  margin-bottom: 8px;
}

.toolbar-mode-switch {
  margin-left: auto;
}

.result-textarea textarea {
  font-family: Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
}

.table-container {
  padding-left: 15px;
  padding-right: 10px;
  box-sizing: border-box;
  margin-top: 12px;
}

.preview-textarea textarea {
  font-family: Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
}

.preview-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-copy {
  margin-right: auto;
}

.anonymous-result-guide {
  width: auto;
  margin: 0 14px 12px;
}

.anonymous-result-guide.el-alert.is-light .el-alert__icon.is-big {
  width: 20px;
  margin-right: 10px;
  font-size: 20px;
}

.anonymous-result-guide.el-alert .el-alert__content {
  flex: 1;
  min-width: 0;
}

.anonymous-result-guide.el-alert.is-light .el-alert__description {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.anonymous-result-guide-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px 12px;
}

.anonymous-result-guide-tip {
  min-width: 0;
}

.anonymous-result-guide-body .el-button {
  flex: 0 0 auto;
}
</style>
