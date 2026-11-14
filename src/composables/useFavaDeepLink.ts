import axios from '../utils/request'
import { useCapabilities } from '../capabilities'

const FAVA_INSTANCE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function openInNewTab(url: string): boolean {
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  return win !== null
}

/**
 * GET /api/fava/ 在 dynamic 模式下会 302 到 /{uuid}/，axios 再跟随 Fava
 * 默认页到 /{uuid}/{slug}/balance_sheet/ 等。深链前缀只能取 /{uuid}，
 * 不能用完整 pathname，否则会拼成 .../balance_sheet/{slug}/query/...
 */
export function resolveFavaPrefix(response: {
  status: number
  data?: { url?: string; deploy_mode?: string }
  request?: { responseURL?: string }
}): string | null {
  const data = response.data
  if (response.status === 200 && data?.url && data.deploy_mode === 'static') {
    return data.url.replace(/\/$/, '')
  }
  if (response.request?.responseURL) {
    const parsed = new URL(response.request.responseURL, window.location.origin)
    const first = parsed.pathname.split('/').filter(Boolean)[0]
    if (first && FAVA_INSTANCE_UUID.test(first)) {
      return `/${first}`
    }
  }
  return null
}

export function joinFavaUrl(prefix: string, relativePath: string): string {
  const normalizedPrefix = prefix.replace(/\/$/, '')
  const normalizedPath = relativePath.replace(/^\//, '')
  return `${normalizedPrefix}/${normalizedPath}`
}

/**
 * 从跟随重定向后的 URL 提取账本 slug（/{uuid}/{slug}/... 的第二段）。
 * 静态模式下没有 slug，返回 null。
 */
export function resolveFavaSlug(response: {
  request?: { responseURL?: string }
}): string | null {
  if (!response.request?.responseURL) {
    return null
  }
  const parsed = new URL(response.request.responseURL, window.location.origin)
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length >= 3) {
    return decodeURIComponent(segments[1])
  }
  return null
}

/**
 * 先启动/解析 Fava 实例，再打开相对深链（不含 uuid 前缀的路径）。
 */
export async function ensureFavaThenOpen(relativePath: string): Promise<boolean> {
  const { can } = useCapabilities()
  if (!can('fava.use')) {
    return false
  }
  const response = await axios.get('/fava/', { withCredentials: true })
  const prefix = resolveFavaPrefix(response)
  if (!prefix) {
    return false
  }
  const targetUrl = joinFavaUrl(prefix, relativePath)
  const absolute = new URL(targetUrl, window.location.origin).toString()
  return openInNewTab(absolute)
}

/**
 * 直接打开 Fava 编辑器。动态模式可从重定向 URL 解析账本 slug；
 * 静态模式无法解析时回落到 Fava 首页。
 */
export async function ensureFavaEditorThenOpen(): Promise<boolean> {
  const { can } = useCapabilities()
  if (!can('fava.use')) {
    return false
  }
  const response = await axios.get('/fava/', { withCredentials: true })
  const prefix = resolveFavaPrefix(response)
  if (!prefix) {
    return false
  }
  const slug = resolveFavaSlug(response)
  const relativePath = slug ? `${slug}/editor/` : ''
  const targetUrl = joinFavaUrl(prefix, relativePath)
  const absolute = new URL(targetUrl, window.location.origin).toString()
  return openInNewTab(absolute)
}
