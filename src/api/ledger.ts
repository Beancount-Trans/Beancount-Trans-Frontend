import axios from '../utils/request'

export interface LedgerExportResult {
  blob: Blob
  filename: string
}

/**
 * 下载当前用户的账本 ZIP
 * GET /api/ledger/export/
 */
export const exportLedgerZip = async (): Promise<LedgerExportResult> => {
  const response = await axios.get('/ledger/export/', {
    responseType: 'blob'
  })

  const contentDisposition = (response.headers['content-disposition'] as string) || ''
  const utf8Match = contentDisposition.match(/filename\*=utf-8''([^;]+)/i)
  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i)

  let filename = 'ledger.zip'
  if (utf8Match?.[1]) {
    filename = decodeURIComponent(utf8Match[1])
  } else if (plainMatch?.[1]) {
    filename = decodeURIComponent(plainMatch[1])
  }

  return { blob: response.data as Blob, filename }
}
