<template>
  <div class="parse-review-form">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>条目审核</h2>
        <el-text type="info" size="small" style="display: block; margin-top: 4px;">
          需关注 {{ attentionEntryCount }} 条 · 已自动通过 {{ autoPassedEntryCount }} 条 · {{ fileSourceCount }} 个账单<template
            v-if="copilotEntryCount > 0"> · Copilot 记账 {{
              copilotEntryCount }} 条</template>
        </el-text>
        <!-- <el-text v-if="remainingTime" type="info" size="small" style="display: block; margin-top: 4px;">
          剩余时间：{{ remainingTime }}
        </el-text> -->
      </div>
      <div class="header-right">
        <el-radio-group v-model="reviewScope" size="small" @change="loadResults">
          <el-radio-button label="attention">需关注 {{ attentionEntryCount }}</el-radio-button>
          <el-radio-button label="all">全部 {{ entryCount }}</el-radio-button>
        </el-radio-group>
        <ReviewModeSwitch />
        <el-dropdown v-if="reparseSourceFiles.length > 0" :disabled="reviewExpired" @command="handleReparseAll">
          <el-button :loading="loading.reparseAll" :disabled="reviewExpired">
            重新解析
            <el-icon class="el-icon--right">
              <ArrowDown />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="file in reparseSourceFiles" :key="file.key" :command="file.file_id">
                {{ file.file_name }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="handleBack">返回</el-button>
      </div>
    </div>

    <el-alert v-if="reviewExpired" type="warning" :closable="false" show-icon title="解析待办已过期，系统将自动写入"
      description="审核截止时间已过，无法再编辑或确认写入。" class="expired-banner" />

    <!-- 加载状态 -->
    <div v-loading="loading.results" class="content-container" :class="{ 'is-review-expired': reviewExpired }">
      <!-- 审核结果：按来源账单分组 -->
      <el-empty v-if="entryGroups.length === 0" :description="emptyDescription" />
      <div v-else class="entry-groups">
        <section v-for="group in entryGroups" :key="group.key" class="entry-group">
          <header class="entry-group-header">
            <el-tag v-if="group.source === 'copilot'" type="info" size="small">Copilot 记账</el-tag>
            <span v-else class="entry-group-title">{{ group.file_name }}</span>
            <span class="entry-group-count">{{ group.entries.length }} 条</span>
          </header>
          <ParseEntryTable :entries="group.entries" :error-entries="errorEntries"
            :validation-warnings="validationWarnings" :disabled="reviewExpired" :mode="reviewMode"
            :on-reparse="handleTableReparse" :on-persist-edit="persistEntryEdit" :on-patch-tags="handleTablePatchTags"
            :on-remove-entry="removeEntryFromReview" />
        </section>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="action-bar">
      <el-text v-if="autoPassedEntryCount > 0" type="info" size="small" class="auto-passed-hint">
        确认写入会一并写入 {{ autoPassedEntryCount }} 条已自动通过条目。
      </el-text>
      <el-button v-if="reviewMode === 'advanced'" @click="handlePreview"
        :disabled="formattedEntries.length === 0 || reviewExpired">
        预览
      </el-button>
      <el-button type="primary" @click="handleConfirmWrite" :loading="loading.confirm"
        :disabled="formattedEntries.length === 0 || reviewExpired">
        确认写入
      </el-button>
    </div>

    <!-- 预览对话框 -->
    <el-dialog v-model="showPreviewDialog" title="预览所有条目" width="80%">
      <el-input v-model="previewContent" type="textarea" :rows="20" class="preview-textarea"
        placeholder="可以在此处编辑所有条目，编辑后点击保存按钮将更新到列表中" />
      <template #footer>
        <el-button @click="showPreviewDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSavePreview" :loading="loading.savePreview">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reparsePasswordDialogVisible" title="输入解密密码" width="450px" :close-on-click-modal="false">
      <p class="reparse-password-tip">
        全部重新解析会覆盖该账单的手改内容。若文件已加密，请输入密码后重试。
      </p>
      <el-input v-model="reparsePassword" type="password" placeholder="密码（选填）" show-password />
      <template #footer>
        <el-button @click="reparsePasswordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading.reparseAll" @click="confirmReparseAllWithPassword">
          确认重新解析
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import ParseEntryTable from '../../components/parse/ParseEntryTable.vue'
import ReviewModeSwitch from '../../components/parse/ReviewModeSwitch.vue'
import { useReviewMode } from '../../composables/useReviewMode'
import {
  getEntryReviewResults,
  reparseEntry,
  updateEntryEdit,
  patchEntryTags,
  confirmWrite,
  reparseAll,
  getParseTaskStatus,
  syncPreviewEntries
} from '../../api/parse-review'
import {
  alignPreviewBlocksToEntries,
  parsePreviewContent
} from '../../utils/parse-review-preview'
import type {
  EntrySourceLocator,
  ErrorEntry,
  FormattedEntry,
  PreviewSyncEntry,
  PreviewSyncResponse,
  ReparseResponse,
  UpdateTagsRequest
} from '../../types/parse-review'
import { emitTaskBannerRefresh } from '../../utils/accountEvents'

const router = useRouter()
const { mode: reviewMode } = useReviewMode()

const entryCount = ref(0)
const attentionEntryCount = ref(0)
const autoPassedEntryCount = ref(0)
/** 页面级展示范围：仅需关注（默认）/ 全部 */
const reviewScope = ref<'attention' | 'all'>('attention')
const formattedEntries = ref<FormattedEntry[]>([])
const reviewExpiresAt = ref<number | null>(null)
const loading = ref({
  results: false,
  reparseAll: false,
  confirm: false,
  savePreview: false
})

const showPreviewDialog = ref(false)
const previewContent = ref('')

const errorEntries = ref<Record<string, string>>({})
const validationWarnings = ref<Record<string, string>>({})

const REPARSE_POLL_INTERVAL_MS = 2000
const REPARSE_POLL_MAX_ATTEMPTS = 150
let reparsePollAborted = false
const reparsePasswordDialogVisible = ref(false)
const reparsePassword = ref('')
const reparseTargetFileId = ref<number | null>(null)

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

onBeforeUnmount(() => {
  reparsePollAborted = true
})

/** 审核来源（账单文件 / Copilot 暂存区 / 循环待办），按条目首次出现顺序去重 */
interface ReviewSource {
  /** 来源键：账单为 file_id 字符串，虚拟来源（Copilot / 循环待办）为来源名 */
  key: string
  source: 'file' | 'copilot' | 'recurring'
  file_id: number | null
  file_name: string
}

/** 来源分组：来源元信息 + 当前可见条目 */
interface ReviewEntryGroup extends ReviewSource {
  entries: FormattedEntry[]
}

/** 来源键：虚拟来源（Copilot / 循环待办）共用一个来源，其余按 file_id 区分 */
const sourceKey = (entry: FormattedEntry): string =>
  entry.source && entry.source !== 'file' ? entry.source : String(entry.file_id)

/** 虚拟来源（无 file_id）的默认展示名 */
const VIRTUAL_SOURCE_LABELS: Record<'copilot' | 'recurring', string> = {
  copilot: 'Copilot 记账',
  recurring: '循环待办',
}

/** 解析条目对应的来源元信息 */
const resolveSourceMeta = (entry: FormattedEntry): ReviewSource => {
  const key = sourceKey(entry)
  const source = entry.source ?? 'file'
  if (source === 'copilot' || source === 'recurring') {
    return {
      key,
      source,
      file_id: null,
      file_name: entry.file_name || VIRTUAL_SOURCE_LABELS[source]
    }
  }
  return {
    key,
    source: 'file',
    file_id: entry.file_id ?? null,
    file_name:
      entry.file_name ||
      (entry.file_id != null ? `文件 #${entry.file_id}` : '未知来源')
  }
}

const sourceFiles = computed<ReviewSource[]>(() => {
  const seen = new Map<string, ReviewSource>()
  for (const entry of formattedEntries.value) {
    const meta = resolveSourceMeta(entry)
    if (seen.has(meta.key)) continue
    seen.set(meta.key, meta)
  }
  return [...seen.values()]
})

/** 仅账单来源可用于重新解析（Copilot 来源后端不支持） */
const reparseSourceFiles = computed(() =>
  sourceFiles.value.filter(
    (item): item is ReviewSource & { file_id: number } =>
      item.source === 'file' && item.file_id != null
  )
)

const fileSourceCount = computed(() => reparseSourceFiles.value.length)

const copilotEntryCount = computed(
  () => formattedEntries.value.filter((entry) => entry.source === 'copilot').length
)

/** 当前展示范围下的条目 */
const visibleEntries = computed(() => {
  if (reviewScope.value === 'attention') {
    return formattedEntries.value.filter((entry) => entry.needs_review !== false)
  }
  return formattedEntries.value
})

/** 当前可见条目按来源分组，组顺序按首次出现，组内保持原顺序 */
const entryGroups = computed<ReviewEntryGroup[]>(() => {
  const groups = new Map<string, ReviewEntryGroup>()
  for (const entry of visibleEntries.value) {
    const meta = resolveSourceMeta(entry)
    const group = groups.get(meta.key)
    if (group) {
      group.entries.push(entry)
      continue
    }
    groups.set(meta.key, { ...meta, entries: [entry] })
  }
  return [...groups.values()]
})

/** 「仅需关注」且存在自动通过条目时，给出空态说明 */
const emptyDescription = computed(() => {
  if (reviewScope.value === 'attention' && autoPassedEntryCount.value > 0) {
    return `没有需要人工确认的条目，${autoPassedEntryCount.value} 条已按分类自动通过；点击「确认写入」即入账。`
  }
  return '暂无解析结果'
})

const findSourceByKey = (key: string): ReviewSource | undefined =>
  sourceFiles.value.find((item) => item.key === key)

/** 解析条目的来源定位信息（无提示） */
const resolveEntrySource = (entry: FormattedEntry): EntrySourceLocator | null => {
  if (entry.source === 'copilot' || entry.source === 'recurring') {
    return { source: entry.source, fileId: null }
  }
  if (entry.file_id == null) {
    return null
  }
  return { source: 'file', fileId: entry.file_id }
}

/** 按条目 uuid 定位其来源；缺失时提示并中断操作 */
const entrySource = (uuid: string): EntrySourceLocator | null => {
  const entry = formattedEntries.value.find((item) => item.uuid === uuid)
  if (!entry) {
    ElMessage.error('未找到条目信息，请刷新页面')
    return null
  }
  const locator = resolveEntrySource(entry)
  if (!locator) {
    ElMessage.error('条目缺少来源账单信息，请刷新页面')
  }
  return locator
}

const applyReparsePayloadToEntry = (entryUuid: string, updated: ReparseResponse) => {
  const index = formattedEntries.value.findIndex((e) => e.uuid === entryUuid)
  if (index !== -1) {
    formattedEntries.value[index] = {
      ...formattedEntries.value[index],
      formatted: updated.formatted,
      edited_formatted: (updated.edited_formatted || '').replace(/\n+$/, ''),
      selected_expense_key: updated.selected_expense_key,
      expense_candidates_with_score: updated.expense_candidates_with_score,
      tag_details: updated.tag_details,
      tag_overrides: updated.tag_overrides
    }
  }
}

/** 表格内反馈分类关键字 / 保存映射后的单条重解析 */
const handleTableReparse = async (
  entryUuid: string,
  selectedKey: string,
  mappingType?: 'expense' | 'income' | 'asset',
  propagateCandidates = false
) => {
  const entry = formattedEntries.value.find((item) => item.uuid === entryUuid)
  if (entry?.source === 'copilot' || entry?.source === 'recurring') {
    ElMessage.warning('该来源条目请直接编辑条目文本')
    return
  }

  const locator = entrySource(entryUuid)
  if (!locator || locator.fileId == null) return

  const response = await reparseEntry({
    file_id: locator.fileId,
    entry_uuid: entryUuid,
    selected_key: selectedKey,
    ...(mappingType ? { mapping_type: mappingType } : {}),
    ...(propagateCandidates ? { propagate_candidates: true } : {})
  })
  const updated = response.data
  applyReparsePayloadToEntry(entryUuid, updated)

  // 新增/编辑映射时，仅同步解析审核页其他匹配条目的候选分类，不动其当前分类
  const candidateUpdated = updated.candidate_updated_entries ?? []
  for (const item of candidateUpdated) {
    const index = formattedEntries.value.findIndex(
      (e) => e.uuid === item.uuid && e.file_id === item.file_id
    )
    if (index !== -1) {
      formattedEntries.value[index] = {
        ...formattedEntries.value[index],
        expense_candidates_with_score: item.expense_candidates_with_score
      }
    }
  }

  ElMessage.success('已更新分类')
  if (candidateUpdated.length > 0) {
    ElMessage.success(`已为 ${candidateUpdated.length} 条相似条目补充候选分类`)
  }
}

/** 表格内标签增删，返回后端最新的 tag 字段供组件回写 */
const handleTablePatchTags = async (uuid: string, payload: UpdateTagsRequest) => {
  const locator = entrySource(uuid)
  if (!locator) return {}
  const response = await patchEntryTags(locator, uuid, payload)
  return response.data
}

// 计算剩余时间（基于整体审核截止时间）
const remainingTime = computed(() => {
  if (!reviewExpiresAt.value) return null

  const expiryTime = reviewExpiresAt.value * 1000
  const remainingMs = expiryTime - Date.now()

  if (remainingMs <= 0) {
    return '已过期，等待自动写入'
  }

  const remainingHours = Math.floor(remainingMs / (3600 * 1000))
  const remainingMinutes = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000))

  if (remainingHours > 0) {
    return `${remainingHours}小时${remainingMinutes}分钟`
  } else {
    return `${remainingMinutes}分钟`
  }
})

const reviewExpired = computed(() => {
  if (reviewExpiresAt.value) {
    return Date.now() >= reviewExpiresAt.value * 1000
  }
  return false
})

// 加载统一条目审核结果（跨账单扁平列表）
const loadResults = async () => {
  loading.value.results = true
  try {
    const response = await getEntryReviewResults()
    const result = response.data

    entryCount.value = result.entry_count
    attentionEntryCount.value = result.attention_entry_count
    autoPassedEntryCount.value = result.auto_passed_entry_count
    reviewExpiresAt.value = result.review_expires_at

    // 确保每条记录都有 edited_formatted，并去除末尾的换行符；保留来源账单信息
    formattedEntries.value = result.entries.map((entry) => ({
      ...entry,
      edited_formatted: (entry.edited_formatted || entry.formatted || '').replace(/\n+$/, ''),
      tag_details: entry.tag_details ?? [],
      tag_overrides: entry.tag_overrides ?? { removed_paths: [], added_paths: [] }
    }))
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '加载条目审核结果失败')
  } finally {
    loading.value.results = false
  }
}

async function persistEntryEdit(uuid: string, editedFormatted: string, options?: { silent?: boolean }) {
  const locator = entrySource(uuid)
  if (!locator) return

  if (errorEntries.value[uuid]) {
    delete errorEntries.value[uuid]
  }

  const response = await updateEntryEdit(locator, uuid, {
    edited_formatted: editedFormatted
  })

  if (response.data.validation_warning) {
    validationWarnings.value[uuid] = response.data.validation_warning
  } else {
    delete validationWarnings.value[uuid]
  }

  if (!options?.silent) {
    ElMessage.success('编辑内容已保存')
  }
}

/** 确认写入前将本地 edited_formatted 静默同步至 Redis（含 Copilot 条目）。 */
async function flushEditedEntries(): Promise<boolean> {
  const updatePromises: Promise<void>[] = []
  let hasMissingSource = false

  for (const entry of formattedEntries.value) {
    const locator = resolveEntrySource(entry)
    if (!locator) {
      hasMissingSource = true
      continue
    }
    const editedContent = entry.edited_formatted.replace(/\n+$/, '')
    updatePromises.push(
      updateEntryEdit(locator, entry.uuid, {
        edited_formatted: editedContent,
      }).then((response) => {
        entry.edited_formatted = editedContent
        if (response.data.validation_warning) {
          validationWarnings.value[entry.uuid] = response.data.validation_warning
        } else {
          delete validationWarnings.value[entry.uuid]
        }
        if (errorEntries.value[entry.uuid]) {
          delete errorEntries.value[entry.uuid]
        }
      }),
    )
  }

  if (hasMissingSource) {
    ElMessage.error('部分条目缺少来源信息，已跳过同步')
  }

  if (!updatePromises.length) {
    return true
  }

  try {
    await Promise.all(updatePromises)
    return true
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: { error?: string } } }
    ElMessage.error(axiosError.response?.data?.error || '同步审核草稿失败，请检查网络后重试')
    return false
  }
}

function buildSyncEntriesPayload(entries: FormattedEntry[] = formattedEntries.value) {
  return entries
    .filter((entry) => entry.edited_formatted.replace(/\n+$/, '').trim())
    .map((entry) => ({
      uuid: entry.uuid,
      edited_formatted: entry.edited_formatted.replace(/\n+$/, '')
    }))
}

/** 清除指定来源内所有条目的本地校验提示（合并前调用） */
function clearValidationWarningsForSources(keys: string[]) {
  const target = new Set(keys)
  for (const entry of formattedEntries.value) {
    if (target.has(sourceKey(entry))) {
      delete validationWarnings.value[entry.uuid]
    }
  }
}

function applyValidationWarnings(warnings?: Record<string, string>) {
  for (const [uuid, message] of Object.entries(warnings ?? {})) {
    validationWarnings.value[uuid] = message
  }
}

/** 清理已不存在条目的写入错误记录 */
function pruneErrorEntries() {
  const keptUuidSet = new Set(formattedEntries.value.map((entry) => entry.uuid))
  for (const uuid of Object.keys(errorEntries.value)) {
    if (!keptUuidSet.has(uuid)) {
      delete errorEntries.value[uuid]
    }
  }
}

/**
 * 来源级合并：用某来源（账单文件 / Copilot 暂存区）同步后的条目替换其原有条目，
 * 保持整体来源顺序。
 */
function mergeSourceSyncResult(source: ReviewSource, formattedData: FormattedEntry[]) {
  const sourceOrder = sourceFiles.value.map((item) => item.key)

  const normalized = formattedData.map((entry) => ({
    ...entry,
    source: source.source,
    file_id: source.source === 'file' ? source.file_id : null,
    file_name:
      source.source === 'copilot'
        ? VIRTUAL_SOURCE_LABELS.copilot
        : source.source === 'recurring'
          ? VIRTUAL_SOURCE_LABELS.recurring
          : source.file_name,
    edited_formatted: (entry.edited_formatted || entry.formatted || '').replace(/\n+$/, ''),
    tag_details: entry.tag_details ?? [],
    tag_overrides: entry.tag_overrides ?? { removed_paths: [], added_paths: [] }
  }))

  const result: FormattedEntry[] = []
  for (const key of sourceOrder) {
    if (key === source.key) {
      result.push(...normalized)
    } else {
      result.push(...formattedEntries.value.filter((entry) => sourceKey(entry) === key))
    }
  }

  formattedEntries.value = result
  entryCount.value = result.length
}

async function removeEntryFromReview(uuid: string) {
  const target = formattedEntries.value.find((entry) => entry.uuid === uuid)
  if (!target) {
    return
  }
  const locator = resolveEntrySource(target)
  if (!locator) {
    ElMessage.error('条目缺少来源账单信息，请刷新页面')
    return
  }
  const targetKey = sourceKey(target)
  const targetSource = findSourceByKey(targetKey)
  if (!targetSource) {
    return
  }

  // 该来源剩余的全部条目（未提交的条目会被从该来源移除）
  const remaining = formattedEntries.value.filter(
    (entry) => sourceKey(entry) === targetKey && entry.uuid !== uuid
  )
  const sourceEntryCount = formattedEntries.value.filter(
    (entry) => sourceKey(entry) === targetKey
  ).length
  if (remaining.length === sourceEntryCount) {
    return
  }

  const response = await syncPreviewEntries(locator, {
    entries: buildSyncEntriesPayload(remaining)
  })
  clearValidationWarningsForSources([targetKey])
  mergeSourceSyncResult(targetSource, response.data.formatted_data)
  applyValidationWarnings(response.data.validation_warnings)
  pruneErrorEntries()
  ElMessage.success('已排除该条目，不会写入账本')
}

// 预览所有条目
const handlePreview = () => {
  previewContent.value = formattedEntries.value
    .map((entry) => entry.edited_formatted.replace(/\n+$/, ''))
    .filter((text) => text.trim())
    .join('\n\n')
  showPreviewDialog.value = true
}

// 保存预览框中的编辑内容（预览文本为真源，按来源账单分别同步）
const handleSavePreview = async () => {
  if (!previewContent.value.trim()) {
    ElMessage.warning('预览内容不能为空')
    return
  }

  loading.value.savePreview = true
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

    if (kept.length > formattedEntries.value.length) {
      ElMessage.warning('预览中新增了条目，暂不支持在预览中新增，请回到列表操作')
      return
    }

    const sourceByUuid = new Map<string, ReviewSource>()
    for (const entry of formattedEntries.value) {
      const key = sourceKey(entry)
      const source = findSourceByKey(key)
      if (source) {
        sourceByUuid.set(entry.uuid, source)
      }
    }

    // 按来源（账单文件 / Copilot 暂存区）分组
    const grouped = new Map<string, { source: ReviewSource; entries: PreviewSyncEntry[] }>()
    for (const item of kept) {
      const source = sourceByUuid.get(item.uuid)
      if (!source) {
        ElMessage.error('条目缺少来源信息，请刷新页面')
        return
      }
      const bucket = grouped.get(source.key)
      if (bucket) {
        bucket.entries.push(item)
      } else {
        grouped.set(source.key, { source, entries: [item] })
      }
    }

    // 原本有条目、但预览中已被全部删除的来源，需提交空数组以移除
    for (const source of sourceFiles.value) {
      if (!grouped.has(source.key)) {
        grouped.set(source.key, { source, entries: [] })
      }
    }

    const syncResults: Array<{ source: ReviewSource; data: PreviewSyncResponse }> = []
    for (const { source, entries } of grouped.values()) {
      const response = await syncPreviewEntries(
        { source: source.source, fileId: source.file_id },
        { entries }
      )
      syncResults.push({ source, data: response.data })
    }

    clearValidationWarningsForSources(syncResults.map((item) => item.source.key))
    for (const item of syncResults) {
      mergeSourceSyncResult(item.source, item.data.formatted_data)
    }
    for (const item of syncResults) {
      applyValidationWarnings(item.data.validation_warnings)
    }
    pruneErrorEntries()

    if (removedCount > 0) {
      ElMessage.success(`预览内容已保存，并移除 ${removedCount} 条已删除条目`)
    } else {
      ElMessage.success('预览内容已保存')
    }
    showPreviewDialog.value = false
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      ElMessage.error(axiosError.response?.data?.error || '保存预览内容失败')
    } else {
      ElMessage.error('保存预览内容失败')
    }
  } finally {
    loading.value.savePreview = false
  }
}

// 确认写入
const handleConfirmWrite = async () => {
  loading.value.confirm = true
  errorEntries.value = {}
  try {
    const flushed = await flushEditedEntries()
    if (!flushed) {
      return
    }

    const copilotCount = copilotEntryCount.value
    await confirmWrite()
    ElMessage.success(
      copilotCount > 0
        ? `确认写入成功，其中 ${copilotCount} 条 Copilot 记账条目已追加写入 collect.bean`
        : '确认写入成功'
    )

    // 返回待办列表
    router.push('/tasks')

    // 延迟触发横幅更新，确保页面跳转完成后再更新
    // 这样横幅组件可以正确检测到任务数量变化并触发导览步骤5
    setTimeout(() => {
      emitTaskBannerRefresh()
    }, 500)
  } catch (error: any) {
    if (error.response?.status === 404) {
      ElMessage.error(
        error.response?.data?.error || '审核缓存缺失，请勿重新解析，请先检查网络后重试写入',
      )
      return
    }
    if (error.response?.data?.error_entries) {
      const entries = error.response.data.error_entries as ErrorEntry[]
      entries.forEach(entry => {
        errorEntries.value[entry.uuid] = entry.error_message
      })
      ElMessage.error(error.response?.data?.error || '确认写入失败，请修正错误')

      // 自动滚动到第一个错误
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.has-error')
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    } else {
      ElMessage.error(error.response?.data?.error || '确认写入失败')
    }
  } finally {
    loading.value.confirm = false
  }
}

// 重新解析指定账单
const pollReparseAllTask = async (celeryTaskId: string) => {
  ElMessage.info('正在重新解析，完成后将自动刷新')

  for (let attempt = 0; attempt < REPARSE_POLL_MAX_ATTEMPTS; attempt++) {
    if (reparsePollAborted) return
    await sleep(REPARSE_POLL_INTERVAL_MS)
    const statusRes = await getParseTaskStatus(celeryTaskId)
    const status = statusRes.data.status

    if (status === 'pending_review' || status === 'parsed') {
      await loadResults()
      ElMessage.success('重新解析完成')
      reparsePasswordDialogVisible.value = false
      reparsePassword.value = ''
      return
    }
    if (status === 'needs_password') {
      reparsePasswordDialogVisible.value = true
      ElMessage.warning('该文件需要解密密码，请输入后重试')
      return
    }
    if (status === 'failed' || status === 'cancelled') {
      ElMessage.error(statusRes.data.error || '重新解析失败')
      return
    }
  }

  ElMessage.warning('解析耗时较长，请稍后手动刷新页面')
}

const submitReparseAll = async (fileId: number, password?: string) => {
  const file = reparseSourceFiles.value.find((item) => item.file_id === fileId)
  const fileName = file?.file_name ?? `文件 #${fileId}`

  loading.value.reparseAll = true
  reparsePollAborted = false
  try {
    try {
      await ElMessageBox.confirm(
        `全部重新解析「${fileName}」会覆盖该账单的手改内容，是否继续？`,
        '重新解析',
        {
          confirmButtonText: '继续',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }

    reparseTargetFileId.value = fileId

    const response = await reparseAll(
      fileId,
      password ? { password } : undefined
    )
    const celeryTaskId = response.data.celery_task_id
    if (!celeryTaskId) {
      ElMessage.warning('未获取到解析任务 ID，请稍后手动刷新')
      return
    }

    await pollReparseAllTask(celeryTaskId)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '重新解析失败')
  } finally {
    loading.value.reparseAll = false
  }
}

const handleReparseAll = async (command: number | string | object) => {
  const fileId = Number(command)
  if (!Number.isFinite(fileId)) {
    return
  }
  await submitReparseAll(fileId)
}

const confirmReparseAllWithPassword = async () => {
  const fileId = reparseTargetFileId.value
  if (fileId == null) {
    ElMessage.warning('未找到目标账单，请重新选择账单')
    return
  }
  const password = reparsePassword.value.trim()
  await submitReparseAll(fileId, password || undefined)
}

// 返回
const handleBack = () => {
  router.push('/tasks')
}

onMounted(() => {
  void loadResults()
})
</script>

<style scoped lang="scss">
.parse-review-form {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color);

  .header-left {
    h2 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.content-container {
  min-height: 400px;
  margin-bottom: 24px;

  &.is-review-expired {
    pointer-events: none;
    opacity: 0.75;
  }
}

.entry-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.entry-group-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.entry-group-title {
  font-size: 14px;
  font-weight: 600;
}

.entry-group-count {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.expired-banner {
  margin-bottom: 16px;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color);
}

.auto-passed-hint {
  margin-right: auto;
  align-self: center;
}

.preview-textarea {
  :deep(.el-textarea__inner) {
    font-family: Monaco, Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
  }
}
</style>
