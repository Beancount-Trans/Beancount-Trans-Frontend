/**
 * 游客首次解析后的「首期月报」握手。
 *
 * 三件事：
 * 1. 记录游客的写入意图，登录回跳后据此判断是否走月报链路；
 * 2. 从解析条目推导账单周期，生成 Copilot 的首期提问；
 * 3. 以 5 分钟 TTL 的一次性 sessionStorage 把提问交给 Copilot 页。
 *
 * 纯会话级存储，读取即删除，不长期留存账单数据。
 */
import type { FormattedEntry } from '../types/parse-review'

const GUEST_WRITE_INTENT_KEY = 'bct_guest_write_intent'
const FIRST_REPORT_PROMPT_KEY = 'bct_first_report_prompt'
const FIRST_REPORT_TTL_MS = 5 * 60 * 1000
/** 与待重解析文件一致：30 分钟后意图失效，避免陈旧标记误触发月报 */
const GUEST_WRITE_INTENT_TTL_MS = 30 * 60 * 1000
const ENTRY_DATE_RE = /(\d{4}-\d{2}-\d{2})/

export interface EntriesPeriod {
  start: string
  end: string
}

export interface PendingFirstReport {
  prompt: string
  createdAt: number
}

/** 标记本次写入来自未登录访客；登录回跳并写入成功后才消费 */
export function markGuestWriteIntent(): void {
  try {
    sessionStorage.setItem(GUEST_WRITE_INTENT_KEY, String(Date.now()))
  } catch (error) {
    console.warn('记录游客写入意图失败:', error)
  }
}

export function hasGuestWriteIntent(): boolean {
  try {
    const raw = sessionStorage.getItem(GUEST_WRITE_INTENT_KEY)
    if (!raw) return false
    const createdAt = Number(raw)
    if (!createdAt || Date.now() - createdAt > GUEST_WRITE_INTENT_TTL_MS) {
      sessionStorage.removeItem(GUEST_WRITE_INTENT_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

export function clearGuestWriteIntent(): void {
  try {
    sessionStorage.removeItem(GUEST_WRITE_INTENT_KEY)
  } catch (error) {
    console.warn('清除游客写入意图失败:', error)
  }
}

/** 从条目的 Beancount 指令中取首个日期，得到账单覆盖区间 */
export function deriveEntriesPeriod(entries: FormattedEntry[]): EntriesPeriod | null {
  let start = ''
  let end = ''
  for (const entry of entries) {
    const text = entry.edited_formatted || entry.formatted || ''
    const match = ENTRY_DATE_RE.exec(text)
    if (!match) continue
    const date = match[1]
    if (!start || date < start) start = date
    if (!end || date > end) end = date
  }
  return start && end ? { start, end } : null
}

/** 首期提问模板：显式给出周期，并触发洞察模式（月度总结 / 支出结构） */
export function buildFirstReportPrompt(period: EntriesPeriod | null): string {
  const periodLine = period
    ? `账单覆盖 ${period.start} 至 ${period.end}。`
    : '这是一份刚写入账本的新账单。'
  const crossMonthLine =
    period && period.start.slice(0, 7) !== period.end.slice(0, 7)
      ? '账单区间跨月，请先按月分别给出合计，再给整体结论。\n'
      : ''

  return `我刚把一份账单写入账本，${periodLine}${crossMonthLine}请只基于这个时间段写一份月度总结（本期账单月报）：
1. 收入合计、支出合计、结余；
2. 支出结构 Top 5（用账户描述，不要写账户路径）；
3. 金额最大的 5 笔消费（商家、金额、日期）；
4. 2–3 个值得注意的发现（反复扣款、退款、异常大额、订阅等）；
5. 最后给 1 条下个月可执行的建议。
用普通人能看懂的话，金额用绝对值；数据不足时直接说明，不要编造。`
}

/** 暂存首期提问，交给 Copilot 页一次性消费 */
export function setPendingFirstReport(prompt: string): void {
  try {
    const payload: PendingFirstReport = { prompt, createdAt: Date.now() }
    sessionStorage.setItem(FIRST_REPORT_PROMPT_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('暂存首期月报提问失败:', error)
  }
}

/** 取出并删除首期提问；无记录或已过期时返回 null */
export function takePendingFirstReport(): PendingFirstReport | null {
  try {
    const raw = sessionStorage.getItem(FIRST_REPORT_PROMPT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(FIRST_REPORT_PROMPT_KEY)
    const payload = JSON.parse(raw) as PendingFirstReport
    if (!payload?.prompt?.trim()) return null
    if (Date.now() - Number(payload.createdAt || 0) > FIRST_REPORT_TTL_MS) return null
    return payload
  } catch (error) {
    console.warn('读取首期月报提问失败:', error)
    try {
      sessionStorage.removeItem(FIRST_REPORT_PROMPT_KEY)
    } catch {
      // 存储不可用时忽略
    }
    return null
  }
}
