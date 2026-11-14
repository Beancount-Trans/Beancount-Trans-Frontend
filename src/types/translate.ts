/**
 * 解析页「写入账本」相关类型定义
 *
 * 写入目标为用户账本的 trans/collect.bean（追加语义）。
 */
import type { ErrorEntry } from './parse-review'

/**
 * 单条待写入条目：directive 为 Beancount 文本（优先取 edited_formatted）
 */
export interface WriteCollectEntry {
  uuid: string
  directive: string
}

/**
 * 写入成功响应
 */
export interface WriteCollectResponse {
  message: string
  /** 已写入条数 */
  entry_count: number
  /** 写入目标（固定为 trans/collect.bean） */
  bean: string
  /** 本次是否为该用户账本的首次写入（用于首期月报） */
  is_first_write?: boolean
}

/**
 * 写入失败响应（语法错误时带定位信息）
 */
export interface WriteCollectErrorResponse {
  error: string
  error_entries?: ErrorEntry[]
}

/**
 * 单个账单类型的解析可用性
 */
export interface BillSupportItem {
  bill_type: string
  /** 最近一次成功解析时间（ISO 8601），无记录为 null */
  last_success_at: string | null
  /** 成功解析的账单中最新一笔交易日期，无记录为 null */
  latest_bill_date: string | null
}

/**
 * 账单解析可用性查询响应
 */
export interface BillSupportResponse {
  bills: BillSupportItem[]
}
