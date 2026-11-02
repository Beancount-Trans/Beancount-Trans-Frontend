/**
 * 解析（translate）API
 *
 * 目前只包含解析页的「写入账本」：把核对后的解析结果追加写入用户的
 * trans/collect.bean（写账本需要登录，匿名请求由后端返回 401）。
 */
import axios from '../utils/request'
import type {
  BillSupportResponse,
  WriteCollectEntry,
  WriteCollectResponse
} from '../types/translate'

/**
 * 写入账本（追加到 trans/collect.bean）
 */
export function writeCollectEntries(
  entries: WriteCollectEntry[]
): Promise<{ data: WriteCollectResponse }> {
  return axios.post('/translate/write-collect', { entries })
}

/**
 * 查询各账单类型的解析可用性（公开接口）
 */
export function getBillSupportStatus(): Promise<{ data: BillSupportResponse }> {
  return axios.get('/translate/bill-support')
}
