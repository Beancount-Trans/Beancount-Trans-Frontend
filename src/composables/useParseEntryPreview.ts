/**
 * Beancount 条目预览交互
 *
 * 覆盖整段文本编辑、过账行账户浮层（含 Tab 补全）、首行标签浮层与结构化片段渲染；
 * 持久化编辑与标签增删通过回调注入，供解析审核页与解析结果页共用。
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type Ref,
  type WritableComputedRef
} from 'vue'
import { ElMessage } from 'element-plus'
import axios from '../utils/request'
import { fetchTagTree } from '../api/tags'
import { findHeaderTagsOutsideQuotes } from '../utils/beancount-header-tags'
import type { FormattedEntry, TagDetail, TagSource } from '../types/parse-review'
import type { Tag } from '../types/tag'

/** 与后端 /account/tree/ 及 AccountSelector 注入结构一致 */
type AccountAssistItem = { account: string; description: string }
type FlatTagAssistItem = { full_path: string; description: string; enable: boolean }
type TabCompleteSession = { start: number; end: number; candidatesKey: string; idx: number }

export type PreviewAccountSegment = {
  kind: 'account'
  text: string
  token: string
  absStart: number
  absEnd: number
}
export type PreviewTagSegment = {
  kind: 'tag'
  text: string
  path: string
  absStart: number
  absEnd: number
}
export type PreviewTextSegment = { kind: 'text'; text: string }
export type PreviewSegment = PreviewAccountSegment | PreviewTagSegment | PreviewTextSegment
export type PreviewLine = { segments: PreviewSegment[]; isHeader?: boolean }

export interface UseParseEntryPreviewOptions {
  entries: Ref<FormattedEntry[]> | WritableComputedRef<FormattedEntry[]>
  errorEntries: Ref<Record<string, string>>
  validationWarnings: Ref<Record<string, string>>
  disabled?: Ref<boolean> | ComputedRef<boolean>
  onPersistEdit: (
    uuid: string,
    editedFormatted: string,
    options?: { silent?: boolean }
  ) => Promise<{ validation_warning?: string } | void>
  onPatchTags: (
    uuid: string,
    payload: { action: 'add' | 'remove'; tag_path: string }
  ) => Promise<{
    edited_formatted?: string
    tag_details?: TagDetail[]
    tag_overrides?: FormattedEntry['tag_overrides']
  }>
}

/** 根为五大类，段内允许非空白（含中文等） */
const ACCOUNT_FULL_RE = /^(?:Assets|Expenses|Income|Liabilities|Equity)(?::[^\s]+)*$/
const POSTING_LINE_RE = /^\s+[!\*]?\s*(?:Assets|Expenses|Income|Liabilities|Equity)(?::|$)/
/** 从过账行提取账户子串（不含行首缩进与金额） */
const POSTING_ACCOUNT_IN_LINE =
  /^\s+[!\*]?\s*((?:Assets|Expenses|Income|Liabilities|Equity)(?::[^\s]+)*)(?=\s|$)/

const HEADER_LINE_RE = /^\d{4}-\d{2}-\d{2}/

/** 兜底账户所在的一侧：资产腿 / 分类腿 */
export type OtherAccountSide = 'asset' | 'category' | null

/** 判断条目是否落到 Other 兜底账户，并区分资产腿与分类腿 */
export function otherAccountSide(editedFormatted: string): OtherAccountSide {
  const text = editedFormatted || ''
  if (/Assets:Other/.test(text)) return 'asset'
  if (/(?:Expenses|Income):Other/.test(text)) return 'category'
  return null
}

function isPostingLine(line: string) {
  return POSTING_LINE_RE.test(line)
}

function getLineBounds(text: string, index: number) {
  let i = index
  while (i > 0 && text[i - 1] !== '\n') i--
  const lineStart = i
  let lineEnd = index
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++
  return { lineStart, lineEnd, line: text.slice(lineStart, lineEnd) }
}

/** 全局下标 pos 落在过账行账户 token 内时，返回该 token 在全文中的起止 */
function findAccountRangeAtGlobalIndex(text: string, pos: number) {
  const { lineStart, line } = getLineBounds(text, pos)
  if (!isPostingLine(line)) return null
  const m = POSTING_ACCOUNT_IN_LINE.exec(line)
  if (!m) return null
  const token = m[1]
  if (!ACCOUNT_FULL_RE.test(token)) return null
  const from = m.index !== undefined ? m.index : 0
  const relAccStart = line.indexOf(token, from)
  if (relAccStart < 0) return null
  const absStart = lineStart + relAccStart
  const absEnd = absStart + token.length
  if (pos < absStart || pos > absEnd) return null
  return { start: absStart, end: absEnd, token }
}

function parseHeaderLineToSegments(line: string, lineBase: number): PreviewSegment[] {
  const matches = findHeaderTagsOutsideQuotes(line)
  if (!matches.length) {
    return [{ kind: 'text', text: line }]
  }
  const segs: PreviewSegment[] = []
  let cursor = 0
  for (const item of matches) {
    if (item.start > cursor) {
      segs.push({ kind: 'text', text: line.slice(cursor, item.start) })
    }
    segs.push({
      kind: 'tag',
      text: item.text,
      path: item.path,
      absStart: lineBase + item.start,
      absEnd: lineBase + item.end
    })
    cursor = item.end
  }
  if (cursor < line.length) {
    segs.push({ kind: 'text', text: line.slice(cursor) })
  }
  return segs.length ? segs : [{ kind: 'text', text: line }]
}

function parseSingleLineToSegments(
  line: string,
  lineBase: number,
  isHeaderLine = false
): PreviewSegment[] {
  if (isHeaderLine) {
    return parseHeaderLineToSegments(line, lineBase)
  }
  if (!isPostingLine(line)) {
    return [{ kind: 'text', text: line }]
  }
  const m = POSTING_ACCOUNT_IN_LINE.exec(line)
  if (!m || !ACCOUNT_FULL_RE.test(m[1])) {
    return [{ kind: 'text', text: line }]
  }
  const token = m[1]
  const from = m.index !== undefined ? m.index : 0
  const idxToken = line.indexOf(token, from)
  if (idxToken < 0) {
    return [{ kind: 'text', text: line }]
  }
  const absStart = lineBase + idxToken
  const absEnd = absStart + token.length
  const prefix = line.slice(0, idxToken)
  const suffix = line.slice(idxToken + token.length)
  const segs: PreviewSegment[] = []
  if (prefix) segs.push({ kind: 'text', text: prefix })
  segs.push({ kind: 'account', text: token, token, absStart, absEnd })
  if (suffix) segs.push({ kind: 'text', text: suffix })
  return segs.length ? segs : [{ kind: 'text', text: line }]
}

/** 将全文拆成多行，每行若干 text / account / tag 片段（含全文下标） */
export function buildLineSegments(fullText: string): PreviewLine[] {
  const lines = (fullText || '').split('\n')
  const out: PreviewLine[] = []
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isHeader = i === 0 && HEADER_LINE_RE.test(line)
    out.push({
      segments: parseSingleLineToSegments(line, offset, isHeader),
      isHeader
    })
    offset += line.length
    if (i < lines.length - 1) offset += 1
  }
  return out
}

/** 编辑框高度随条目行数变化，避免短条目被固定撑到 7 行。 */
export function getEntryAutosize(text: string) {
  const lineCount = Math.max(1, (text || '').split('\n').length)
  return { minRows: lineCount, maxRows: Math.max(40, lineCount) }
}

/** 查询串是否为账户名的有序子序列（如 wefu → …WechatFund） */
function isOrderedSubsequence(haystackLower: string, needleLower: string): boolean {
  if (!needleLower) return true
  let i = 0
  for (let j = 0; j < haystackLower.length && i < needleLower.length; j++) {
    if (haystackLower[j] === needleLower[i]) i++
  }
  return i === needleLower.length
}

function accountMatchTier(item: AccountAssistItem, qLower: string): number {
  const al = item.account.toLowerCase()
  const dl = (item.description || '').toLowerCase()
  if (al.includes(qLower)) return 0
  if (dl.includes(qLower)) return 1
  if (isOrderedSubsequence(al, qLower)) return 2
  return 3
}

function accountMatchesAssistQuery(item: AccountAssistItem, qLower: string): boolean {
  if (!qLower) return false
  return accountMatchTier(item, qLower) < 3
}

function longestCommonPrefix(strs: string[]): string {
  if (!strs.length) return ''
  let s = strs[0]
  for (let k = 1; k < strs.length; k++) {
    const t = strs[k]
    let j = 0
    while (j < s.length && j < t.length && s[j] === t[j]) j++
    s = s.slice(0, j)
    if (!s) return ''
  }
  return s
}

/** 将视口坐标映射为与 `edited_formatted` 一致的字符偏移（块级行间为换行符） */
function getCharOffsetInPreviewRoot(
  root: HTMLElement,
  clientX: number,
  clientY: number
): number | null {
  const doc = root.ownerDocument
  if (!doc) return null
  let node: Node | null = null
  let offset = 0
  const d = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null
  }
  const range = d.caretRangeFromPoint?.(clientX, clientY)
  if (range) {
    node = range.startContainer
    offset = range.startOffset
  } else {
    const pos = d.caretPositionFromPoint?.(clientX, clientY)
    if (pos) {
      node = pos.offsetNode
      offset = pos.offset
    }
  }
  if (!node || !root.contains(node)) return null
  try {
    const pre = doc.createRange()
    pre.selectNodeContents(root)
    pre.setEnd(node, offset)
    return pre.toString().replace(/\r\n/g, '\n').length
  } catch {
    return null
  }
}

export function useParseEntryPreview(options: UseParseEntryPreviewOptions) {
  const { entries, errorEntries, validationWarnings } = options
  const isDisabled = () => !!options.disabled?.value

  const entryInputRefs = new Map<string, { textarea?: HTMLTextAreaElement }>()

  /** 进入整段编辑前的文本快照：清空内容时回滚，而不是删除条目 */
  const entryEditSnapshot = new Map<string, string>()

  /** 某条条目是否处于整段 textarea 编辑模式（默认 false = 结构化预览） */
  const entryTextEditMode = ref<Record<string, boolean>>({})

  const isEntryTextEditMode = (uuid: string) => !!entryTextEditMode.value[uuid]

  const setEntryTextEditMode = (uuid: string, on: boolean) => {
    if (on) {
      entryTextEditMode.value = { ...entryTextEditMode.value, [uuid]: true }
    } else {
      const next = { ...entryTextEditMode.value }
      delete next[uuid]
      entryTextEditMode.value = next
    }
  }

  // ---------------------------------------------------------------- 账户浮层

  const accountTreeForAssist = ref<any[]>([])
  const flatAccounts = ref<AccountAssistItem[]>([])
  const flatAccountNames = computed(() => flatAccounts.value.map((a) => a.account))
  const accountDescriptionByName = computed(() => {
    const map: Record<string, string> = {}
    for (const item of flatAccounts.value) {
      if (item.description) map[item.account] = item.description
    }
    return map
  })

  const accountPopover = ref({
    visible: false,
    x: 0,
    y: 0,
    entryUuid: '',
    replaceStart: 0,
    replaceEnd: 0,
    originalToken: ''
  })

  const accountAssistQuery = ref('')
  const accountOverlayQueryRef = ref<{ focus: () => void } | null>(null)
  const accountSuggestionsListRef = ref<HTMLUListElement | null>(null)
  /** 浮层建议列表当前高亮下标（↑↓ 移动，回车 / Tab 应用该项） */
  const overlayActiveIndex = ref(0)

  const tabCompleteByUuid = ref<Record<string, TabCompleteSession | undefined>>({})

  const accountAssistPanelStyle = computed(() => {
    const pad = 8
    const panelW = 420
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const left = Math.max(pad, Math.min(accountPopover.value.x, vw - panelW - pad))
    const top = Math.max(pad, Math.min(accountPopover.value.y + pad, vh - 200))
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${panelW}px`,
      zIndex: 3001
    }
  })

  function closeAccountAssistOverlay() {
    accountPopover.value.visible = false
    accountAssistQuery.value = ''
  }

  const onEscapeCloseOverlay = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && accountPopover.value.visible) {
      closeAccountAssistOverlay()
    }
  }

  const overlayAccountMatches = computed(() => {
    if (!accountPopover.value.visible) return []
    const q = accountAssistQuery.value.trim().toLowerCase()
    if (!q) return []
    const hits = flatAccounts.value.filter((a) => accountMatchesAssistQuery(a, q))
    hits.sort((a, b) => {
      const ai = accountMatchTier(a, q)
      const bi = accountMatchTier(b, q)
      if (ai !== bi) return ai - bi
      if (a.account.length !== b.account.length) return a.account.length - b.account.length
      return a.account.localeCompare(b.account)
    })
    return hits.slice(0, 80)
  })

  watch(overlayAccountMatches, async () => {
    overlayActiveIndex.value = 0
    await nextTick()
    const ul = accountSuggestionsListRef.value
    const active = ul?.querySelector('.parse-review-account-suggestion-item.is-active')
    active?.scrollIntoView({ block: 'nearest' })
  })

  watch(overlayActiveIndex, async () => {
    await nextTick()
    const ul = accountSuggestionsListRef.value
    if (!ul) return
    const active = ul.querySelector('.parse-review-account-suggestion-item.is-active')
    active?.scrollIntoView({ block: 'nearest' })
  })

  watch(
    () => accountPopover.value.visible,
    async (visible) => {
      if (visible) {
        window.addEventListener('keydown', onEscapeCloseOverlay)
        accountAssistQuery.value = ''
        await nextTick()
        await nextTick()
        accountOverlayQueryRef.value?.focus?.()
      } else {
        window.removeEventListener('keydown', onEscapeCloseOverlay)
        accountAssistQuery.value = ''
      }
    }
  )

  function rebuildFlatAccounts() {
    const map = new Map<string, string>()
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        if (n.account) {
          map.set(n.account, (n.description ?? '').trim())
        }
        if (n.children?.length) walk(n.children)
      }
    }
    walk(accountTreeForAssist.value)
    flatAccounts.value = Array.from(map.entries())
      .map(([account, description]) => ({ account, description }))
      .sort((a, b) => a.account.localeCompare(b.account))
  }

  async function loadAccountTreeAssist() {
    try {
      const response = await axios.get('/account/tree/')
      let data: any[] = []
      if (Array.isArray(response.data)) data = response.data as any[]
      else if (response.data && Array.isArray(response.data.results)) {
        data = response.data.results as any[]
      }
      accountTreeForAssist.value = data
      rebuildFlatAccounts()
    } catch {
      accountTreeForAssist.value = []
      flatAccounts.value = []
    }
  }

  function openAccountAssist(payload: {
    entryUuid: string
    replaceStart: number
    replaceEnd: number
    originalToken: string
    clientX: number
    clientY: number
  }) {
    accountPopover.value = {
      visible: true,
      x: payload.clientX,
      y: payload.clientY,
      entryUuid: payload.entryUuid,
      replaceStart: payload.replaceStart,
      replaceEnd: payload.replaceEnd,
      originalToken: payload.originalToken
    }
  }

  function openAccountAssistFromSegment(
    row: FormattedEntry,
    seg: PreviewAccountSegment,
    e: MouseEvent
  ) {
    if (isDisabled()) return
    openAccountAssist({
      entryUuid: row.uuid,
      replaceStart: seg.absStart,
      replaceEnd: seg.absEnd,
      originalToken: seg.token,
      clientX: e.clientX,
      clientY: e.clientY
    })
  }

  async function applyAccountReplacementByName(accountName: string) {
    const pop = accountPopover.value
    if (!pop.visible || !pop.entryUuid) return

    const row = entries.value.find((r) => r.uuid === pop.entryUuid)
    if (!row) return

    const t = row.edited_formatted
    const oldText = t
    const newText = t.slice(0, pop.replaceStart) + accountName + t.slice(pop.replaceEnd)
    row.edited_formatted = newText

    accountPopover.value.visible = false
    accountAssistQuery.value = ''

    const focusPos = pop.replaceStart + accountName.length
    try {
      await options.onPersistEdit(pop.entryUuid, newText)
    } catch (error: any) {
      row.edited_formatted = oldText
      ElMessage.error(error.response?.data?.error || '更新编辑内容失败')
      return
    }
    if (isEntryTextEditMode(pop.entryUuid)) {
      const input = entryInputRefs.get(pop.entryUuid)
      const ta = input?.textarea
      if (ta) {
        nextTick(() => {
          ta.focus()
          ta.setSelectionRange(focusPos, focusPos)
        })
      }
    }
  }

  async function applyOverlayAccountByInput() {
    const q = accountAssistQuery.value.trim()
    if (!q) {
      ElMessage.warning('请输入账户名、描述或从下方列表选择')
      return
    }
    if (flatAccountNames.value.includes(q)) {
      await applyAccountReplacementByName(q)
      return
    }
    const lower = q.toLowerCase()
    const exactCi = flatAccountNames.value.filter((a) => a.toLowerCase() === lower)
    if (exactCi.length === 1) {
      await applyAccountReplacementByName(exactCi[0])
      return
    }
    const exactDesc = flatAccounts.value.filter(
      (a) => a.description && a.description.toLowerCase() === lower
    )
    if (exactDesc.length === 1) {
      await applyAccountReplacementByName(exactDesc[0].account)
      return
    }
    if (exactDesc.length > 1) {
      ElMessage.warning('多个账户具有相同描述，请用 ↑↓ 选择一条，或补充筛选后再回车')
      return
    }
    const subs = overlayAccountMatches.value
    if (subs.length === 1) {
      await applyAccountReplacementByName(subs[0].account)
      return
    }
    if (subs.length > 1) {
      ElMessage.warning('请用 ↑↓ 选择一条，或补充筛选至仅一条后再回车')
      return
    }
    ElMessage.warning('未找到匹配的账户，请检查输入')
  }

  function onOverlayQueryKeydown(e: Event | KeyboardEvent) {
    if (!(e instanceof KeyboardEvent)) return
    const list = overlayAccountMatches.value
    if (e.key === 'ArrowDown') {
      if (!list.length) return
      e.preventDefault()
      overlayActiveIndex.value = Math.min(overlayActiveIndex.value + 1, list.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      if (!list.length) return
      e.preventDefault()
      overlayActiveIndex.value = Math.max(overlayActiveIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      if (list.length) {
        e.preventDefault()
        const idx = Math.min(Math.max(0, overlayActiveIndex.value), list.length - 1)
        void applyAccountReplacementByName(list[idx].account)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        void applyOverlayAccountByInput()
      }
    }
  }

  // ---------------------------------------------------------------- 标签浮层

  const flatTagsForAssist = ref<FlatTagAssistItem[]>([])
  const tagPopover = ref({
    visible: false,
    x: 0,
    y: 0,
    entryUuid: ''
  })
  const tagAssistQuery = ref('')
  const tagOverlayQueryRef = ref<{ focus: () => void } | null>(null)
  const tagSuggestionsListRef = ref<HTMLUListElement | null>(null)
  const tagOverlayActiveIndex = ref(0)

  const tagAssistPanelStyle = computed(() => {
    const pad = 8
    const panelW = 420
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const left = Math.max(pad, Math.min(tagPopover.value.x, vw - panelW - pad))
    const top = Math.max(pad, Math.min(tagPopover.value.y + pad, vh - 200))
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${panelW}px`,
      zIndex: 3001
    }
  })

  function rebuildFlatTags(nodes: Tag[]) {
    const out: FlatTagAssistItem[] = []
    const walk = (items: Tag[]) => {
      for (const node of items) {
        if (node.full_path) {
          out.push({
            full_path: node.full_path,
            description: (node.description ?? '').trim(),
            enable: node.enable !== false
          })
        }
        if (node.children?.length) walk(node.children)
      }
    }
    walk(nodes)
    flatTagsForAssist.value = out.sort((a, b) => a.full_path.localeCompare(b.full_path))
  }

  async function loadTagTreeAssist() {
    try {
      const response = await fetchTagTree()
      const data = Array.isArray(response.data) ? response.data : []
      rebuildFlatTags(data)
    } catch {
      flatTagsForAssist.value = []
    }
  }

  function closeTagAssistOverlay() {
    tagPopover.value.visible = false
    tagAssistQuery.value = ''
  }

  const onEscapeCloseTagOverlay = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && tagPopover.value.visible) {
      closeTagAssistOverlay()
    }
  }

  function getEntryExistingTagPaths(row: FormattedEntry): Set<string> {
    const paths = new Set<string>()
    for (const detail of row.tag_details ?? []) {
      if (detail.path) paths.add(detail.path.toLowerCase())
    }
    if (paths.size === 0 && row.edited_formatted) {
      const firstLine = row.edited_formatted.split('\n')[0] ?? ''
      for (const item of findHeaderTagsOutsideQuotes(firstLine)) {
        paths.add(item.path.toLowerCase())
      }
    }
    return paths
  }

  const overlayTagMatches = computed(() => {
    if (!tagPopover.value.visible) return []
    const row = entries.value.find((item) => item.uuid === tagPopover.value.entryUuid)
    const existingPaths = row ? getEntryExistingTagPaths(row) : new Set<string>()
    const q = tagAssistQuery.value.trim().toLowerCase()
    const available = flatTagsForAssist.value.filter((t) => {
      if (!t.enable) return false
      if (existingPaths.has(t.full_path.toLowerCase())) return false
      if (!q) return true
      return t.full_path.toLowerCase().includes(q)
    })
    return available.slice(0, 80)
  })

  watch(overlayTagMatches, async () => {
    tagOverlayActiveIndex.value = 0
    await nextTick()
    const ul = tagSuggestionsListRef.value
    const active = ul?.querySelector('.parse-review-tag-suggestion-item.is-active')
    active?.scrollIntoView({ block: 'nearest' })
  })

  watch(tagOverlayActiveIndex, async () => {
    await nextTick()
    const ul = tagSuggestionsListRef.value
    if (!ul) return
    const active = ul.querySelector('.parse-review-tag-suggestion-item.is-active')
    active?.scrollIntoView({ block: 'nearest' })
  })

  watch(
    () => tagPopover.value.visible,
    async (visible) => {
      if (visible) {
        window.addEventListener('keydown', onEscapeCloseTagOverlay)
        tagAssistQuery.value = ''
        await nextTick()
        tagOverlayQueryRef.value?.focus?.()
      } else {
        window.removeEventListener('keydown', onEscapeCloseTagOverlay)
        tagAssistQuery.value = ''
      }
    }
  )

  function openTagAssist(row: FormattedEntry, e: MouseEvent) {
    if (isDisabled()) return
    tagPopover.value = {
      visible: true,
      x: e.clientX,
      y: e.clientY,
      entryUuid: row.uuid
    }
  }

  function formatTagSourceLabel(source: TagSource): string {
    if (source.type === 'source') return '账单原始标签'
    if (source.type === 'manual') return '手动添加'
    if (source.type === 'mapping' && source.key) {
      const typeLabel =
        source.mapping_type === 'asset'
          ? '资产映射'
          : source.mapping_type === 'income'
            ? '收入映射'
            : '支出映射'
      return `${typeLabel}关键字：${source.key}`
    }
    return '未知来源'
  }

  function getTagSourcesForPath(row: FormattedEntry, path: string): TagSource[] {
    const normalized = path.toLowerCase()
    const detail = (row.tag_details ?? []).find((item) => item.path.toLowerCase() === normalized)
    return detail?.sources ?? [{ type: 'manual' }]
  }

  function applyTagFieldsToRow(
    row: FormattedEntry,
    payload: {
      edited_formatted?: string
      tag_details?: TagDetail[]
      tag_overrides?: FormattedEntry['tag_overrides']
    }
  ) {
    if (payload.edited_formatted !== undefined) {
      row.edited_formatted = payload.edited_formatted.replace(/\n+$/, '')
    }
    if (payload.tag_details !== undefined) {
      row.tag_details = payload.tag_details
    }
    if (payload.tag_overrides !== undefined) {
      row.tag_overrides = payload.tag_overrides
    }
  }

  async function removeTagFromEntry(row: FormattedEntry, tagPath: string) {
    if (isDisabled()) return
    try {
      const payload = await options.onPatchTags(row.uuid, {
        action: 'remove',
        tag_path: tagPath
      })
      applyTagFieldsToRow(row, payload)
      ElMessage.success('标签已移除')
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '移除标签失败')
    }
  }

  async function applyTagAddition(tagPath: string) {
    const pop = tagPopover.value
    if (!pop.visible || !pop.entryUuid) return
    const row = entries.value.find((item) => item.uuid === pop.entryUuid)
    if (!row) return

    try {
      const payload = await options.onPatchTags(row.uuid, {
        action: 'add',
        tag_path: tagPath
      })
      applyTagFieldsToRow(row, payload)
      closeTagAssistOverlay()
      ElMessage.success('标签已添加')
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '添加标签失败')
    }
  }

  function onTagOverlayQueryKeydown(e: Event | KeyboardEvent) {
    if (!(e instanceof KeyboardEvent)) return
    const list = overlayTagMatches.value
    if (e.key === 'ArrowDown') {
      if (!list.length) return
      e.preventDefault()
      tagOverlayActiveIndex.value = Math.min(tagOverlayActiveIndex.value + 1, list.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      if (!list.length) return
      e.preventDefault()
      tagOverlayActiveIndex.value = Math.max(tagOverlayActiveIndex.value - 1, 0)
      return
    }
    if (e.key === 'Enter') {
      if (!list.length) return
      e.preventDefault()
      const idx = Math.min(Math.max(0, tagOverlayActiveIndex.value), list.length - 1)
      void applyTagAddition(list[idx].full_path)
    }
  }

  // ------------------------------------------------------------ 文本编辑模式

  function setEntryInputRef(uuid: string, el: unknown) {
    if (el && typeof el === 'object') {
      const comp = el as { textarea?: HTMLTextAreaElement }
      if (comp.textarea instanceof HTMLTextAreaElement) {
        entryInputRefs.set(uuid, comp)
        return
      }
    }
    entryInputRefs.delete(uuid)
  }

  function clearTabCompleteSession(uuid: string) {
    delete tabCompleteByUuid.value[uuid]
  }

  function startTextEdit(uuid: string, caret?: number) {
    if (isDisabled()) return
    const row = entries.value.find((item) => item.uuid === uuid)
    if (row) entryEditSnapshot.set(uuid, row.edited_formatted)
    clearTabCompleteSession(uuid)
    setEntryTextEditMode(uuid, true)
    nextTick(() => {
      nextTick(() => {
        const ta = entryInputRefs.get(uuid)?.textarea
        ta?.focus()
        if (ta && typeof caret === 'number' && caret >= 0) {
          const c = Math.min(caret, ta.value.length)
          ta.setSelectionRange(c, c)
        }
      })
    })
  }

  function onEntryPreviewShellClick(row: FormattedEntry, e: MouseEvent) {
    const t = e.target as HTMLElement
    if (t.closest('.entry-preview-account-link')) return
    if (t.closest('.entry-preview-tag-chip')) return
    if (t.closest('.entry-preview-tag-add')) return
    const root = e.currentTarget
    const max = row.edited_formatted?.length ?? 0
    let caret = max
    if (root instanceof HTMLElement) {
      const raw = getCharOffsetInPreviewRoot(root, e.clientX, e.clientY)
      if (raw !== null) caret = Math.min(Math.max(0, raw), max)
    }
    startTextEdit(row.uuid, caret)
  }

  /** 结束整段文本编辑：保存并回到预览（回车保存 / 失焦保存共用） */
  async function finishEntryTextEdit(row: FormattedEntry) {
    // 先退出编辑态，避免 textarea 卸载触发的 blur 再次保存
    setEntryTextEditMode(row.uuid, false)

    const normalized = row.edited_formatted.replace(/\n+$/, '').trim()
    if (!normalized) {
      // 清空文本不再等同于删除条目：回滚到编辑前内容，删除改用行内「排除」按钮
      const snapshot = entryEditSnapshot.get(row.uuid)
      entryEditSnapshot.delete(row.uuid)
      if (snapshot !== undefined) row.edited_formatted = snapshot
      ElMessage.warning('条目内容不能为空')
      return
    }
    entryEditSnapshot.delete(row.uuid)
    try {
      await options.onPersistEdit(row.uuid, row.edited_formatted)
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '更新编辑内容失败')
    }
  }

  async function onEntryTextareaBlur(row: FormattedEntry) {
    if (!isEntryTextEditMode(row.uuid)) return
    await finishEntryTextEdit(row)
  }

  /** 回车保存并退出编辑；Shift+回车换行，中文输入法组词回车不处理 */
  function onEntryTextareaEnter(row: FormattedEntry, e: Event | KeyboardEvent) {
    if (!(e instanceof KeyboardEvent)) return
    if (e.shiftKey || e.isComposing) return
    e.preventDefault()
    void finishEntryTextEdit(row)
  }

  const handleEntryPreviewTab = (row: FormattedEntry, e: KeyboardEvent) => {
    if (e.shiftKey) return
    const input = entryInputRefs.get(row.uuid)
    const ta = input?.textarea
    if (!ta) return

    const text = row.edited_formatted
    const cur = ta.selectionStart
    const range = findAccountRangeAtGlobalIndex(text, cur)
    if (!range) return
    if (cur < range.start || cur > range.end) return

    const typed = text.slice(range.start, cur)
    if (typed.length < 1) return

    const names = flatAccountNames.value.filter((a) => a.startsWith(typed))
    if (names.length === 0) return

    const fullToken = text.slice(range.start, range.end)
    if (names.length === 1 && names[0] === fullToken && cur === range.end) return

    e.preventDefault()

    const candidatesKey = names.join('\0')
    let sess = tabCompleteByUuid.value[row.uuid]
    if (
      !sess ||
      sess.start !== range.start ||
      sess.end !== range.end ||
      sess.candidatesKey !== candidatesKey
    ) {
      sess = { start: range.start, end: range.end, candidatesKey, idx: 0 }
      tabCompleteByUuid.value[row.uuid] = sess
    }

    const lcp = longestCommonPrefix(names)
    if (lcp.length > typed.length) {
      const newText = text.slice(0, range.start) + lcp + text.slice(range.end)
      row.edited_formatted = newText
      delete tabCompleteByUuid.value[row.uuid]
      nextTick(() => {
        const nc = range.start + lcp.length
        ta.setSelectionRange(nc, nc)
      })
      return
    }

    if (names.length > 1) {
      const pick = names[sess!.idx % names.length]
      sess!.idx += 1
      const newText = text.slice(0, range.start) + pick + text.slice(range.end)
      row.edited_formatted = newText
      nextTick(() => {
        const nc = range.start + pick.length
        ta.setSelectionRange(nc, nc)
      })
      return
    }

    const pick = names[0]
    const newText = text.slice(0, range.start) + pick + text.slice(range.end)
    row.edited_formatted = newText
    delete tabCompleteByUuid.value[row.uuid]
    nextTick(() => {
      const nc = range.start + pick.length
      ta.setSelectionRange(nc, nc)
    })
  }

  const bindEntryPreviewTab = (row: FormattedEntry) => (e: Event) => {
    if (e instanceof KeyboardEvent) {
      handleEntryPreviewTab(row, e)
    }
  }

  /** 条目预览的外框类名（错误 / 警告 / Other 分类 / 编辑态） */
  const getEntryClasses = (uuid: string, editedFormatted: string) => {
    const isError = !!errorEntries.value[uuid]
    const isWarning = !!validationWarnings.value[uuid] && !isError

    // 检查是否包含 Other 分类
    const isOther = otherAccountSide(editedFormatted) !== null

    return [
      'entry-preview-wrapper',
      {
        'has-error': isError,
        'has-warning': isWarning,
        'has-other': isOther && !isError && !isWarning, // 错误和警告优先级更高
        'is-entry-preview-mode': !isEntryTextEditMode(uuid),
        'is-entry-edit-mode': isEntryTextEditMode(uuid)
      }
    ]
  }

  /** 条目被移除后清理本地编辑态缓存 */
  function forgetEntry(uuid: string) {
    clearTabCompleteSession(uuid)
    entryInputRefs.delete(uuid)
    entryEditSnapshot.delete(uuid)
    setEntryTextEditMode(uuid, false)
  }

  onMounted(() => {
    void loadAccountTreeAssist()
    void loadTagTreeAssist()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onEscapeCloseOverlay)
    window.removeEventListener('keydown', onEscapeCloseTagOverlay)
  })

  return {
    // 文本编辑
    isEntryTextEditMode,
    startTextEdit,
    setEntryInputRef,
    clearTabCompleteSession,
    bindEntryPreviewTab,
    onEntryPreviewShellClick,
    onEntryTextareaBlur,
    onEntryTextareaEnter,
    getEntryClasses,
    getEntryAutosize,
    buildLineSegments,
    forgetEntry,
    // 账户浮层
    accountPopover,
    accountAssistQuery,
    accountAssistPanelStyle,
    accountDescriptionByName,
    accountOverlayQueryRef,
    accountSuggestionsListRef,
    overlayAccountMatches,
    overlayActiveIndex,
    closeAccountAssistOverlay,
    openAccountAssistFromSegment,
    applyAccountReplacementByName,
    onOverlayQueryKeydown,
    loadAccountTreeAssist,
    // 标签浮层
    tagPopover,
    tagAssistQuery,
    tagAssistPanelStyle,
    tagOverlayQueryRef,
    tagSuggestionsListRef,
    overlayTagMatches,
    tagOverlayActiveIndex,
    closeTagAssistOverlay,
    openTagAssist,
    applyTagAddition,
    removeTagFromEntry,
    onTagOverlayQueryKeydown,
    formatTagSourceLabel,
    getTagSourcesForPath,
    loadTagTreeAssist
  }
}
