<template>
  <el-upload class="upload-demo" :drag="true" :action="action" method="POST" :data="getUploadData" :multiple="false"
    :headers="headers" accept=".csv,.pdf,.xls,.xlsx,.zip" show-file-list name="trans" @success="handleUploadSuccess"
    @error="handleUploadError">
    <div class="el-upload__text">
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      拖拽文件至此处 或 <em>单击上传</em>
    </div>
    <p class="upload-privacy-hint">
      该操作不会保存您的任何文件，所有上传的文件均在处理完成后立即删除
    </p>
    <template #tip>
      <div class="el-upload__tip">
        当前支持<a :href="wechatUrl" download>微信</a>、<a :href="alipayUrl" download>支付宝</a>、
        <el-popover placement="top-start" :width="220" trigger="hover" content="
        中国工商银行储蓄卡（ICBC）
        中国建设银行储蓄卡（CCB）
        中国银行储蓄卡（BOC）
        ">
          <template #reference><a>储蓄卡</a>
          </template>
        </el-popover>、
        <el-popover placement="top-start" :width="220" trigger="hover" content="招商银行信用卡（CMB）">
          <template #reference><a>信用卡</a>
          </template>
        </el-popover>账单
        <el-select v-model="value4" multiple collapse-tags collapse-tags-tooltip :max-collapse-tags="2"
          placeholder="可选功能" style="width: 300px">
          <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="input" style="width: 250px" type="password" v-if="showPassword" placeholder="PDF/ZIP 文件解密密码"
          show-password>
          <template #prefix>
            <el-icon>
              <Lock />
            </el-icon>
          </template>
        </el-input>
      </div>
    </template>
  </el-upload>

  <div v-if="hasEntries" class="result-toolbar">
    <el-button type="success" :icon="DocumentCopy" @click="copyResponseData">
      复制结果
    </el-button>
    <el-button @click="handlePreview">
      预览
    </el-button>
    <el-button type="primary" :icon="DocumentChecked" @click="handleWriteCollect" :loading="writing">
      写入账本
    </el-button>
  </div>

  <el-input v-if="!hasEntries" class="result-textarea" type="textarea" :rows="30" readonly :value="''" placeholder='解析结果如下：

2022-06-19 * "温州市数据管理发展集团有限公司" "HIK-停车缴费-洞头人民路停车场(人民路区域共享)"
    time: "15:27:44"
    uuid: "2022061922001474561419808812"
    status: "ALiPay - 交易成功"
    Expenses:TransPort:Private:Park +5.00 CNY
    Liabilities:CreditCard:Bank:CITIC:C6428 -5.00 CNY
' />

  <div v-else class="table-container">
    <ParseEntryTable :entries="formattedEntries" :error-entries="errorEntries" :validation-warnings="validationWarnings"
      :on-reparse="handleTableReparse" :on-persist-edit="handlePersistEdit" :on-patch-tags="handlePatchTags"
      :on-remove-entry="handleRemoveEntry" :require-auth="hasAuthTokens" />
  </div>

  <el-dialog v-model="showPreviewDialog" title="预览所有条目" width="80%">
    <el-input v-model="previewContent" type="textarea" :rows="20" class="preview-textarea"
      placeholder="可以在此处编辑所有条目，编辑后点击保存按钮将更新到列表中" />
    <template #footer>
      <el-button @click="showPreviewDialog = false">取消</el-button>
      <el-button type="primary" @click="handleSavePreview" :loading="savingPreview">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, ElPopover } from 'element-plus'
import { UploadFilled, DocumentCopy, DocumentChecked, Lock } from '@element-plus/icons-vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../../utils/request'
import { hasAuthTokens, setLoginRedirect } from '../../utils/auth'
import ParseEntryTable from '../parse/ParseEntryTable.vue'
import {
  alignPreviewBlocksToEntries,
  parsePreviewContent
} from '../../utils/parse-review-preview'
import { applyTagOverridesToHeader } from '../../utils/beancount-header-tags'
import { writeCollectEntries } from '../../api/translate'
import {
  clearParseDraft,
  loadParseDraft,
  saveParseDraft
} from '../../composables/useParseDraft'
import type { FormattedEntry, TagDetail, OriginalRow } from '../../types/parse-review'

const router = useRouter()

const input = ref()
const wechatUrl = ref('https://dl.dhr2333.cn/%E5%AE%8C%E6%95%B4%E6%B5%8B%E8%AF%95_%E5%BE%AE%E4%BF%A1.csv')
const alipayUrl = ref('https://dl.dhr2333.cn/%E5%AE%8C%E6%95%B4%E6%B5%8B%E8%AF%95_%E6%94%AF%E4%BB%98%E5%AE%9D.csv')
const value4 = ref<string[]>([])
const options = [
  {
    value: '使用平台 LLM',
    label: '使用 LLM（提高准确率但更慢）',
  },
  {
    value: '文件若加密请选择',
    label: '文件若加密请选择',
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
const isWrite = ref(false)
const cmbCreditIgnore = ref(false)
const bocDebitIgnore = ref(false)
const noIgnore = ref(false)
const showPassword = ref(false)
/** 是否按次使用平台 LLM；不勾选时按用户配置（默认本地 BERT） */
const usePlatformLlm = ref(false)

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

const token = localStorage.getItem('access')

const headers = computed(() => ({
  'X-CSRFToken': csrfToken.value,
  Authorization: `Bearer ${token}`,
}))

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

const handleUploadSuccess = (response: any, file: any) => {
  if (file.status === 'error') return
  const normalized: FormattedEntry[] = Array.isArray(response.results)
    ? response.results.map((item: Record<string, any>) => toFormattedEntry(item))
    : []

  formattedEntries.value = normalized
  errorEntries.value = {}
  validationWarnings.value = {}
  // 新解析结果取代旧结果，清掉可能存在的登录前草稿
  clearParseDraft()
}

const handleUploadError = (err: any, _file: any) => {
  let errMsg = ''
  try {
    const parsed = JSON.parse(err.message)
    errMsg = parsed?.error || parsed?.message || ''
  } catch {
    errMsg = err?.message || ''
  }

  if (errMsg.includes('PDF解密失败') || errMsg.includes('ZIP 解密失败') || errMsg.includes('解密失败')) {
    ElMessage.error(errMsg || '解密失败，请检查口令')
  } else if (errMsg === '当前账单不支持' || errMsg.includes('Unsupported')) {
    ElMessage.error('当前账单不支持或文件损坏')
  } else if (errMsg.includes('API密钥') || errMsg.includes('API 密钥')) {
    ElMessage.error(errMsg)
  } else if (errMsg === 'DeepSeek调用失败，请检查API密钥是否正确') {
    ElMessage.error('DeepSeek调用失败，请检查API密钥是否正确')
  } else {
    ElMessage.error(errMsg || '未知错误')
  }
}

const copyResponseData = async () => {
  try {
    await navigator.clipboard.writeText(joinedEditedText.value)
    // 复制即视为结果已导出，清掉登录前草稿，刷新后不再恢复
    clearParseDraft()
    ElMessage.success('复制成功')
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动选择内容复制')
  }
}

/** 挂载时恢复解析草稿（匿名用户「写入账本」引导登录后回跳继续） */
onMounted(() => {
  const draft = loadParseDraft()
  if (!draft || formattedEntries.value.length > 0) return
  formattedEntries.value = draft.entries
  ElMessage.info(
    '已恢复上次未写入的解析结果：该结果基于公共配置解析，可核对编辑后再写入账本'
  )
})

/**
 * 写入账本：把当前结果校验后追加写入 trans/collect.bean。
 * 未登录时先引导登录，并把解析结果暂存为草稿，登录后回跳恢复。
 */
const handleWriteCollect = async () => {
  if (!hasEntries.value || writing.value) return

  if (!hasAuthTokens()) {
    saveParseDraft(formattedEntries.value)
    try {
      await ElMessageBox.confirm(
        '当前解析结果已暂存在本页，登录成功后会自动恢复。',
        '写入账本需登录',
        { confirmButtonText: '去登录', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    setLoginRedirect('/trans')
    router.push('/login')
    return
  }

  try {
    await ElMessageBox.confirm(
      `将把 ${formattedEntries.value.length} 条条目追加写入你的 trans/collect.bean` +
      '（追加写入，不可自动撤销）。',
      '确认写入账本',
      { confirmButtonText: '写入', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  writing.value = true
  try {
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
  ElMessage.success('条目已移除')
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

.upload-privacy-hint {
  color: var(--ep-text-color-secondary);
  font-size: 0.9em;
  margin: 6px 0 0;
}

.result-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  margin-bottom: 8px;
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
</style>
