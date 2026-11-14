import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportLedgerZip } from '../api/ledger'
import { extractApiErrorMessage } from '../utils/errorHelper'

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const resolveErrorMessage = async (error: any): Promise<string> => {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      return extractApiErrorMessage(JSON.parse(text), '导出失败，请稍后重试')
    } catch {
      return '导出失败，请稍后重试'
    }
  }
  return extractApiErrorMessage(data, '导出失败，请稍后重试')
}

/** 下载账本 ZIP：成功后直接触发浏览器下载 */
export const useLedgerExport = () => {
  const exporting = ref(false)

  const handleExport = async () => {
    if (exporting.value) return

    exporting.value = true
    try {
      const { blob, filename } = await exportLedgerZip()
      saveBlob(blob, filename)
      ElMessage.success('账本已导出')
    } catch (error: any) {
      ElMessage.error(await resolveErrorMessage(error))
    } finally {
      exporting.value = false
    }
  }

  return { exporting, handleExport }
}
