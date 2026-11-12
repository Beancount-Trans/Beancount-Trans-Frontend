/**
 * 单条 Beancount 交易的解析与序列化。
 *
 * 仅服务于审核页「表单模式」编辑：把一条交易拆成日期、商户、备注、金额、
 * 账户等字段，改完后按原结构拼回去，未修改的行保持原样。
 */

import { findHeaderTagsOutsideQuotes } from './beancount-header-tags'

export interface ParsedPosting {
  lineIndex: number
  indent: string
  flagPrefix: string
  account: string
  /** 账户在行内的起始下标（缩进 + 可选 flag 之后） */
  accountStart: number
  /** 账户之后的剩余文本（trim 后） */
  amountText: string
  numeric: number | null
  numericText: string | null
  currency: string | null
  crossCurrency: boolean
}

export interface ParsedEntry {
  ok: boolean
  reason?: string
  lines: string[]
  headerIndex: number
  date: string
  flag: string
  payee: string
  note: string
  /** note / payee 结束位置之后的原文（tags、links） */
  headerRest: string
  tags: string[]
  postings: ParsedPosting[]
}

export interface EntryPatch {
  date?: string
  payee?: string
  note?: string
  accountChanges?: Array<{ lineIndex: number; account: string }>
  amountChanges?: Array<{ lineIndex: number; amountText: string }>
}

export interface AmountEditability {
  editable: boolean
  reason?: string
  primary: ParsedPosting | null
  absolute: number | null
  currency: string | null
  scale: number
}

const HEADER_RE = /^(\d{4}-\d{2}-\d{2})\s+([*!])\s+"((?:[^"\\]|\\.)*)"/
const HEADER_LINE_RE = /^\d{4}-\d{2}-\d{2}\s/
const POSTING_RE =
  /^(\s+)([*!]\s+)?((?:Assets|Expenses|Income|Liabilities|Equity)(?::[^\s]+)*)(.*)$/
const AMOUNT_RE = /^([+-]?\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9'._-]*)(.*)$/

function unescapeQuoted(value: string): string {
  return value.replace(/\\(["\\])/g, '$1')
}

function escapeQuoted(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function emptyParsed(lines: string[], reason: string): ParsedEntry {
  return {
    ok: false,
    reason,
    lines,
    headerIndex: -1,
    date: '',
    flag: '',
    payee: '',
    note: '',
    headerRest: '',
    tags: [],
    postings: []
  }
}

export function parseBeancountEntry(text: string): ParsedEntry {
  const lines = (text || '').replace(/\n+$/, '').split('\n')
  const headerIndex = lines.findIndex((line) => HEADER_RE.test(line))
  if (headerIndex < 0) {
    return emptyParsed(lines, '未找到交易头行')
  }

  const headerCount = lines.filter((line) => HEADER_LINE_RE.test(line)).length
  if (headerCount > 1) {
    return emptyParsed(lines, '包含多条交易')
  }

  const header = lines[headerIndex]
  const headerMatch = HEADER_RE.exec(header)
  if (!headerMatch) {
    return emptyParsed(lines, '交易头行格式无法识别')
  }

  const date = headerMatch[1]
  const flag = headerMatch[2]
  const payee = unescapeQuoted(headerMatch[3])
  let cursor = headerMatch[0].length

  const noteMatch = /^\s+"((?:[^"\\]|\\.)*)"/.exec(header.slice(cursor))
  let note = ''
  if (noteMatch) {
    note = unescapeQuoted(noteMatch[1])
    cursor += noteMatch[0].length
  }

  const headerRest = header.slice(cursor).trim()
  const tags = findHeaderTagsOutsideQuotes(header).map((item) => item.path)
  const postings: ParsedPosting[] = []

  for (let i = 0; i < lines.length; i++) {
    if (i === headerIndex) continue
    const postingMatch = POSTING_RE.exec(lines[i])
    if (!postingMatch) continue

    const indent = postingMatch[1]
    const flagPrefix = postingMatch[2] || ''
    const account = postingMatch[3]
    const amountText = (postingMatch[4] || '').trim()
    const amountMatch = AMOUNT_RE.exec(amountText)

    postings.push({
      lineIndex: i,
      indent,
      flagPrefix,
      account,
      accountStart: indent.length + flagPrefix.length,
      amountText,
      numeric: amountMatch ? Number(amountMatch[1]) : null,
      numericText: amountMatch ? amountMatch[1] : null,
      currency: amountMatch ? amountMatch[2] : null,
      crossCurrency: amountText.includes('@@')
    })
  }

  if (postings.length < 2) {
    return emptyParsed(lines, '过账行不足')
  }

  return {
    ok: true,
    lines,
    headerIndex,
    date,
    flag,
    payee,
    note,
    headerRest,
    tags,
    postings
  }
}

export function buildBeancountEntry(parsed: ParsedEntry, patch: EntryPatch): string {
  if (!parsed.ok || parsed.headerIndex < 0) {
    return parsed.lines.join('\n')
  }

  const lines = [...parsed.lines]
  const payee = patch.payee ?? parsed.payee
  const note = patch.note ?? parsed.note
  const headerParts = [`${patch.date ?? parsed.date} ${parsed.flag} "${escapeQuoted(payee)}"`]
  if (note) {
    headerParts.push(`"${escapeQuoted(note)}"`)
  }
  if (parsed.headerRest) {
    headerParts.push(parsed.headerRest)
  }
  lines[parsed.headerIndex] = headerParts.join(' ')

  for (const change of patch.accountChanges ?? []) {
    const posting = parsed.postings.find((item) => item.lineIndex === change.lineIndex)
    if (!posting) continue
    const line = lines[change.lineIndex]
    const before = line.slice(0, posting.accountStart)
    const after = line.slice(posting.accountStart + posting.account.length).trimStart()
    lines[change.lineIndex] = after ? `${before}${change.account} ${after}` : `${before}${change.account}`
  }

  for (const change of patch.amountChanges ?? []) {
    const posting = parsed.postings.find((item) => item.lineIndex === change.lineIndex)
    if (!posting) continue
    const line = lines[change.lineIndex]
    const before = line.slice(0, posting.accountStart)
    const afterPrefix = line.slice(posting.accountStart)
    const accountMatch = /^\S+/.exec(afterPrefix)
    if (!accountMatch) continue
    const account = accountMatch[0]
    const amountText = change.amountText.trim()
    lines[change.lineIndex] = amountText
      ? `${before}${account} ${amountText}`
      : `${before}${account}`
  }

  return lines.join('\n')
}

function decimalPlaces(numericText: string | null): number {
  if (!numericText) return 0
  const index = numericText.indexOf('.')
  return index < 0 ? 0 : numericText.length - index - 1
}

export function getAmountEditability(parsed: ParsedEntry): AmountEditability {
  const primary = parsed.postings[0] ?? null
  const notEditable = (reason: string): AmountEditability => ({
    editable: false,
    reason,
    primary,
    absolute: primary && primary.numeric !== null ? Math.abs(primary.numeric) : null,
    currency: primary?.currency ?? null,
    scale: Math.max(2, decimalPlaces(primary?.numericText ?? null))
  })

  if (!parsed.ok || !primary) return notEditable('该条目结构无法识别')
  if (primary.numeric === null || !primary.currency) return notEditable('该条目没有可识别的金额')
  if (parsed.postings.some((item) => item.crossCurrency)) {
    return notEditable('该条目涉及多币种折算')
  }
  if (parsed.postings.length !== 2) {
    return notEditable('该条目包含多条过账，结构较复杂')
  }

  const explicit = parsed.postings.filter((item) => item.numeric !== null)
  if (explicit.length > 2) return notEditable('该条目包含多条金额过账')

  const currencies = new Set(explicit.map((item) => item.currency))
  if (currencies.size > 1) return notEditable('该条目包含多种币种')

  if (
    explicit.length === 2
    && explicit[0].numeric !== null
    && explicit[1].numeric !== null
    && Math.abs(Math.abs(explicit[0].numeric) - Math.abs(explicit[1].numeric)) > 1e-9
  ) {
    return notEditable('两条过账金额不一致，结构较复杂')
  }

  return {
    editable: true,
    primary,
    absolute: Math.abs(primary.numeric),
    currency: primary.currency,
    scale: Math.max(2, decimalPlaces(primary.numericText))
  }
}

export function buildAmountChanges(
  parsed: ParsedEntry,
  absoluteAmount: number,
  editability: AmountEditability
): Array<{ lineIndex: number; amountText: string }> {
  const primary = editability.primary
  if (!editability.editable || !primary || primary.numeric === null || !primary.currency) {
    return []
  }

  const sign = primary.numeric < 0 ? -1 : 1
  const nextPrimary = sign * Math.abs(absoluteAmount)
  const primaryScale = editability.scale
  const formatWithSign = (value: number, scale: number, valueSign: 1 | -1) =>
    `${valueSign < 0 ? '-' : '+'}${Math.abs(value).toFixed(scale)}`

  const changes = [
    {
      lineIndex: primary.lineIndex,
      amountText: `${formatWithSign(nextPrimary, primaryScale, sign)} ${primary.currency}`
    }
  ]

  const secondary = parsed.postings[1]
  if (secondary && secondary.numeric !== null && secondary.currency) {
    const secondaryScale = Math.max(2, decimalPlaces(secondary.numericText))
    changes.push({
      lineIndex: secondary.lineIndex,
      amountText: `${formatWithSign(-nextPrimary, secondaryScale, sign < 0 ? 1 : -1)} ${secondary.currency}`
    })
  }

  return changes
}
