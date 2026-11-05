import axios from '../utils/request'
import type {
  GitRepository,
  CreateRepositoryRequest,
  LinkRepositoryRequest,
  SyncStatusInfo,
  SyncResponse,
  DeployKeyResponse,
  DeleteRepositoryResponse,
  ClearSyncedLedgerResponse,
  LedgerCommitPreview,
  LedgerCommitResult
} from '../types/git'

/**
 * Git 仓库相关 API 调用
 */

/**
 * 获取用户 Git 仓库信息
 * GET /api/git/repository/
 */
export const getGitRepository = async (): Promise<GitRepository> => {
  const response = await axios.get(`/git/repository/`)
  return response.data
}

/**
 * 启用 Git 功能，创建仓库
 * POST /api/git/repository/
 */
export const createGitRepository = async (data: CreateRepositoryRequest): Promise<GitRepository> => {
  const response = await axios.post(`/git/repository/`, data)
  return response.data
}

/**
 * 关联已有外部 Git 远程（SSH）
 * POST /api/git/repository/link/
 */
export const linkGitRepository = async (data: LinkRepositoryRequest): Promise<GitRepository> => {
  const response = await axios.post(`/git/repository/link/`, data)
  return response.data
}

/**
 * 更新仓库设置（如自动导入账本新增账户）
 * PATCH /api/git/repository/settings/
 */
export const updateGitRepositorySettings = async (
  data: Pick<GitRepository, 'auto_import_ledger_accounts'>
): Promise<GitRepository> => {
  const response = await axios.patch(`/git/repository/settings/`, data)
  return response.data
}

/**
 * 删除用户 Git 仓库
 * DELETE /api/git/repository/delete/
 */
export const deleteGitRepository = async (): Promise<DeleteRepositoryResponse> => {
  const response = await axios.delete(`/git/repository/delete/`)
  return response.data
}

/**
 * 下载 Deploy Key 私钥文件
 * GET /api/git/repository/deploy-key/
 */
export const downloadDeployKey = async (): Promise<Blob> => {
  const response = await axios.get(`/git/repository/deploy-key/`, {
    responseType: 'blob'
  })
  return response.data
}

/**
 * 重新生成并下载 Deploy Key
 * POST /api/git/repository/deploy-key/regenerate/
 */
export const regenerateDeployKey = async (): Promise<Blob> => {
  const response = await axios.post(`/git/repository/deploy-key/regenerate/`, {}, {
    responseType: 'blob'
  })
  return response.data
}

/**
 * 手动触发同步
 * POST /api/git/sync/
 */
export const triggerSync = async (): Promise<SyncResponse> => {
  const response = await axios.post(`/git/sync/`)
  return response.data
}

/**
 * 取消同步：清除服务器本地账本副本并暂停自动拉取
 * POST /api/git/sync/cancel/
 */
export const cancelSync = async (): Promise<ClearSyncedLedgerResponse> => {
  const response = await axios.post(`/git/sync/cancel/`)
  return response.data
}

/**
 * 获取同步状态
 * GET /api/git/sync/status/
 */
export const getSyncStatus = async (): Promise<SyncStatusInfo> => {
  const response = await axios.get(`/git/sync/status/`)
  return response.data
}

/**
 * 预览 trans/ 条目迁移到月度账本
 * POST /api/git/trans/commit/preview/
 */
export const previewTransCommit = async (): Promise<LedgerCommitPreview> => {
  const response = await axios.post(`/git/trans/commit/preview/`)
  return response.data
}

/**
 * 提交 trans/ 条目到月度账本并推送远程
 * POST /api/git/trans/commit/
 */
export const commitTrans = async (): Promise<LedgerCommitResult> => {
  const response = await axios.post(`/git/trans/commit/`)
  return response.data
}

/**
 * 工具函数：下载文件到用户设备
 */
export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * 工具函数：处理 Deploy Key 下载
 */
export const handleDeployKeyDownload = async (regenerate: boolean = false) => {
  try {
    const blob = regenerate 
      ? await regenerateDeployKey()
      : await downloadDeployKey()

    const username = localStorage.getItem('username') || 'user'
    const suffix = regenerate ? '_new' : ''
    const filename = `${username}_deploy_key${suffix}.pem`

    downloadFile(blob, filename)

    return {
      success: true,
      message: regenerate ? 'Deploy Key 已重新生成并下载' : 'Deploy Key 已下载'
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || '下载失败'
    }
  }
}

/**
 * 工具函数：轮询同步状态
 */
export const pollSyncStatus = (
  onStatusUpdate: (status: SyncStatusInfo) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 30
): Promise<SyncStatusInfo> => {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const poll = async () => {
      try {
        attempts++
        const status = await getSyncStatus()
        onStatusUpdate(status)

        // 如果同步完成（成功或失败），停止轮询
        if (status.status === 'success' || status.status === 'failed') {
          resolve(status)
          return
        }

        // 如果超过最大尝试次数，停止轮询
        if (attempts >= maxAttempts) {
          resolve(status)
          return
        }

        // 继续轮询
        setTimeout(poll, intervalMs)

      } catch (error) {
        reject(error)
      }
    }

    poll()
  })
}