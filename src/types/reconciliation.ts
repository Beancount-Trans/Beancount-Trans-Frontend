/**
 * 对账相关类型定义
 */

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  INACTIVE = 'inactive',
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REVOKED = 'revoked'
}

/**
 * 任务状态显示文本映射
 */
export const TaskStatusLabels: Record<TaskStatus, string> = {
  [TaskStatus.INACTIVE]: '未激活',
  [TaskStatus.PENDING]: '待执行',
  [TaskStatus.COMPLETED]: '已完成',
  [TaskStatus.CANCELLED]: '已取消',
  [TaskStatus.REVOKED]: '已撤销'
}

/**
 * 待办任务接口
 */
export interface ScheduledTask {
  id: number
  task_type: string
  task_type_display: string
  scheduled_date: string | null  // 条目审核待办可能为 null
  completed_date: string | null
  status: TaskStatus
  status_display: string
  account_name: string | null
  account_type: string | null
  review_expires_at?: number | null  // 条目审核待办的用户审核截止时间（Unix 时间戳，秒）
  entry_count?: number | null  // 条目审核待办的待审核条目数
  recurring_label?: string | null  // 循环待办展示标签（取定义内容派生）
  next_run_date?: string | null  // 循环待办：本次待办完成后的下一次待办生成日期
  created: string
  modified: string
}

/**
 * 循环基准
 * - scheduled: 按计划日期（下一次 = 上一次待办日期 + rrule）
 * - completed: when done（下一次 = 完成日期 + rrule）
 */
export type RecurrenceBasis = 'scheduled' | 'completed'

/**
 * 到期产出
 * - notify: 生成文本提醒（循环待办卡片）
 * - generate_review: 到期把固定模板并入统一审核队列，生成审核条目
 */
export type RecurringKind = 'notify' | 'generate_review'

/**
 * 循环待办定义接口
 */
export interface RecurringTask {
  id: number
  rule_text: string
  rrule: string
  start_date: string | null
  recurrence_basis: RecurrenceBasis
  /** 到期产出类型 */
  kind: RecurringKind
  /** 固定模板正文（kind=generate_review 时使用，原样生成审核条目，无占位符） */
  template: string
  /** 备注/通知类文本（kind=notify 时作为待办内容） */
  note: string
  next_run_date: string | null  // 管理页展示用：下一次执行日期（动态推算，不入库）
  has_pending: boolean          // 是否存在待执行实例（存在时管理页日期只读，只能改实例日期）
  created: string
  modified: string
}

/**
 * 循环待办定义创建/更新请求体（可写字段）
 * 界面暴露规则、到期产出与内容；note/start_date 可选
 */
export interface RecurringTaskPayload {
  rule_text: string
  note?: string
  start_date?: string | null
  kind?: RecurringKind
  template?: string
}

/**
 * 循环规则预览结果
 */
export interface RecurrencePreview {
  rule_text: string
  describe: string
  basis?: RecurrenceBasis
  next_occurrences?: string[]
  /** 本期待办日期（= 基准日期 start_date）；到期即按该日期生成待办 */
  first_occurrence?: string | null
  /** 若现在创建会立即生成的日期列表（notify 至多 1 条，generate_review 补齐全部到期周期） */
  immediate_dates?: string[]
  /** generate_review 补齐后推进到的下一次预期日期 */
  next_expected_date?: string | null
  /** 规则不可满足（无任何发生日期） */
  ended?: boolean
}

/** 条目审核待办是否已过用户审核截止时间（截止时间为空表示长期有效，永不过期） */
export function isReviewExpired(task: Pick<ScheduledTask, 'review_expires_at' | 'created'>): boolean {
  if (task.review_expires_at === null || task.review_expires_at === undefined) {
    return false
  }
  return Date.now() >= task.review_expires_at * 1000
}

/**
 * Transaction 条目接口（用于差额处理）
 */
export interface TransactionItem {
  account: string  // 账户路径（字符串）
  accountId?: number | null  // 账户 ID（用于 AccountSelector）
  amount?: number | null  // 金额（留空时为自动计算）
  is_auto?: boolean  // 是否为自动计算（前端提交时，如果 amount 为空，自动设置为 true）
  date?: string | null  // 交易日期（可选，仅 is_auto=false 时可指定，不能超过 as_of_date）
}

/**
 * 币种余额接口
 */
export interface CurrencyBalance {
  currency: string
  expected_balance: string
}

/**
 * 对账时间点类型
 */
export type ReconciliationTiming = 'end_of_day' | 'start_of_next_day'

/**
 * 对账表单数据接口
 */
export interface ReconciliationFormData {
  expectedBalance: number
  actualBalance: number | undefined
  currency: string
  reconciliationTiming: ReconciliationTiming
  transactionItems: TransactionItem[]
}

/**
 * 开始对账响应接口
 */
export interface ReconciliationStartResponse {
  balances: CurrencyBalance[]
  account_name: string
  as_of_date: string
  default_currency: string | null
  is_first_reconciliation: boolean
  default_allocation_account: string
  last_reconciliation_date: string | null
  last_completed_task_id: number | null
  default_reconciliation_timing: ReconciliationTiming
  last_reconciliation_transaction_items?: Array<{
    account: string
    amount?: string | null
    is_auto?: boolean
    date?: string | null
  }>
}

/**
 * 执行对账请求接口
 */
export interface ReconciliationExecuteRequest {
  actual_balance: number
  currency: string
  transaction_items: TransactionItem[]
  as_of_date: string
}

/**
 * 执行对账响应接口
 */
export interface ReconciliationExecuteResponse {
  status: string
  directives: string[]
  next_task_id: number | null
}

/**
 * 待办任务更新请求接口
 */
export interface ScheduledTaskUpdateRequest {
  scheduled_date: string
}

/**
 * 撤销对账响应接口
 */
export interface RevokeReconciliationResponse {
  new_task_id: number
  entries_commented: number
  message: string
}
