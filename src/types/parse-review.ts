/**
 * 条目审核（统一待办）相关类型定义
 */

export interface OriginalRow {
  transaction_time: string
  transaction_category: string
  counterparty: string
  commodity: string
  transaction_type: string
  amount: string | number
  payment_method?: string
  transaction_status?: string
  bill_identifier?: string
  [key: string]: any
}

export interface TagSource {
  type: 'mapping' | 'source' | 'manual'
  key?: string
  mapping_type?: 'expense' | 'income' | 'asset'
}

export interface TagDetail {
  path: string
  sources: TagSource[]
}

export interface TagOverrides {
  removed_paths: string[]
  added_paths: string[]
}

/**
 * 条目来源：账单文件解析 / Copilot 记账 / 循环待办
 */
export type EntrySource = 'file' | 'copilot' | 'recurring'

/**
 * 写操作来源定位信息：账单来源带 file_id，Copilot / 循环待办来源 file_id 为 null
 */
export interface EntrySourceLocator {
  source: EntrySource
  fileId: number | null
}

/**
 * 条目审核关注度原因：仅兜底账户与结构异常需要人工审核
 */
export type EntryReviewReason =
  | 'asset_fallback'
  | 'category_fallback'
  | 'balance_fallback'
  | 'unparsable'

/**
 * 格式化条目
 */
export interface FormattedEntry {
  uuid: string
  formatted: string
  edited_formatted: string
  selected_expense_key: string | null
  expense_candidates_with_score: Array<{
    key: string
    score: number
  }>
  original_row?: OriginalRow
  tag_details?: TagDetail[]
  tag_overrides?: TagOverrides
  installment_role?: 'purchase' | 'installment' | null
  installment_period?: number | null
  /** 条目来源（缺省按 'file' 处理，兼容旧数据） */
  source?: EntrySource
  /** 来源账单文件 ID（统一条目审核接口返回）；Copilot / 循环待办条目为 null */
  file_id?: number | null
  /** 来源账单文件名（统一条目审核接口返回）；Copilot 为 'Copilot 记账'，循环待办为定义标题 */
  file_name?: string
  /** 是否需要人工审核；false 表示已自动通过，仅在「全部」视图展示 */
  needs_review?: boolean
  /** 需要人工审核的原因 */
  review_reason?: EntryReviewReason | null
  /** 命中兜底规则的账户 */
  review_account?: string | null
}

/**
 * 统一条目审核结果（跨账单扁平条目列表）
 */
export interface EntryReviewResults {
  entries: FormattedEntry[]
  entry_count: number
  /** 需要人工审核的条目数 */
  attention_entry_count: number
  /** 已自动通过的条目数 */
  auto_passed_entry_count: number
  /** 整体审核截止时间（Unix 时间戳，秒），无有效条目时为 null */
  review_expires_at: number | null
}

/**
 * 条目审核待办任务（每个用户全局唯一）
 */
export interface EntryReviewTask {
  id: number
  task_type: 'entry_review'
  status: 'inactive' | 'pending' | 'completed' | 'cancelled'
  entry_count?: number | null
  review_expires_at?: number | null
  created: string
  modified: string
}

/**
 * 重解析请求
 */
export interface ReparseRequest {
  /** 条目所属账单文件 ID */
  file_id: number
  entry_uuid: string
  selected_key: string
  mapping_type?: 'expense' | 'income' | 'asset'
  /** 新增/编辑映射时置 true：把关键字补充为同批匹配条目的候选分类 */
  propagate_candidates?: boolean
}

/**
 * 重解析响应
 */
export interface ReparseResponse {
  uuid: string
  formatted: string
  edited_formatted: string
  selected_expense_key: string
  expense_candidates_with_score: Array<{
    key: string
    score: number
  }>
  tag_details?: TagDetail[]
  tag_overrides?: TagOverrides
  /** propagate_candidates 时，被补充候选分类的其他条目（仅候选变化） */
  candidate_updated_entries?: CandidateUpdatedEntry[]
}

/**
 * 候选分类被补充的条目（当前分类不变）
 */
export interface CandidateUpdatedEntry {
  uuid: string
  /** 条目所属账单文件 ID */
  file_id: number
  expense_candidates_with_score: Array<{
    key: string
    score: number
  }>
}

/**
 * 更新编辑内容请求
 */
export interface UpdateEditRequest {
  edited_formatted: string
  /** 条目来源（缺省 'file'） */
  source?: EntrySource
}

/**
 * 更新编辑内容响应
 */
export interface UpdateEditResponse {
  uuid: string
  edited_formatted: string
  validation_warning?: string
}

export interface PreviewSyncEntry {
  uuid: string
  edited_formatted: string
}

export interface PreviewSyncRequest {
  entries: PreviewSyncEntry[]
  /** 条目来源（缺省 'file'） */
  source?: EntrySource
}

export interface PreviewSyncResponse {
  formatted_data: FormattedEntry[]
  removed_count: number
  validation_warnings?: Record<string, string>
}

/**
 * 更新标签请求
 */
export interface UpdateTagsRequest {
  action: 'add' | 'remove'
  tag_path: string
  /** 条目来源（缺省 'file'） */
  source?: EntrySource
}

/**
 * 更新标签响应
 */
export interface UpdateTagsResponse {
  uuid: string
  edited_formatted: string
  tag_details: TagDetail[]
  tag_overrides: TagOverrides
}

/**
 * 确认写入错误条目
 */
export interface ErrorEntry {
  /** 条目所属账单文件 ID（Copilot 条目为 null） */
  file_id?: number | null
  /** 条目来源（缺省 'file'） */
  source?: EntrySource
  uuid: string
  index: number
  error_message: string
}

/**
 * 确认写入成功响应
 */
export interface ConfirmWriteResponse {
  message: string
  /** 已写入的账单文件列表 */
  files: Array<{
    file_id: number
    entry_count: number
  }>
}

export interface ReparseAllRequest {
  password?: string
}

export interface ReparseAllResponse {
  message: string
  file_id: number
  celery_task_id?: string
}

export interface ParseTaskStatusResponse {
  task_id: string
  file_id?: number
  status: string
  error?: string | null
}

export interface ConfirmWriteErrorResponse {
  error: string
  error_entries?: ErrorEntry[]
}

/**
 * 是否显示「新增映射」按钮。
 * 不计收支条目显示资产映射入口；支出/收入条目显示对应收支映射入口。
 */
export function shouldShowParseReviewCreateMapping(row: FormattedEntry): boolean {
  return row.installment_role !== 'installment'
}

export function isNeutralParseReviewEntry(row: FormattedEntry): boolean {
  const txType = row.original_row?.transaction_type?.trim()
  return txType === '/' || txType === '不计收支'
}

export function isInstallmentRepaymentEntry(row: FormattedEntry): boolean {
  return row.installment_role === 'installment'
}
