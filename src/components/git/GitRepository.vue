<template>
  <div class="git-repository">
    <el-card shadow="never" class="repo-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="title-row">
              <el-icon class="header-icon">
                <FolderOpened />
              </el-icon>
              <span class="title">Git 仓库管理</span>
            </div>
          </div>
          <div class="header-right">
            <el-tag :type="repository.sync_paused ? SyncStatusType.paused : SyncStatusType[repository.sync_status]"
              :icon="getSyncIcon(repository.sync_paused ? 'paused' : repository.sync_status)" effect="plain">
              {{ repository.sync_paused ? SyncStatusText.paused : SyncStatusText[repository.sync_status] }}
            </el-tag>
            <el-button type="primary" link :loading="syncing"
              :disabled="repository.sync_status === 'syncing' || !can('git.sync')" @click="triggerSync">
              <el-icon class="el-icon--left">
                <Refresh />
              </el-icon>
              {{ syncing ? '同步中...' : (repository.sync_paused ? '恢复同步' : '立即同步') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 仓库信息 -->
      <div class="repo-info-section">
        <el-descriptions border :column="3" class="repo-descriptions">
          <el-descriptions-item label="仓库名称">
            <span class="repo-name">{{ repository.repo_name }}</span>
          </el-descriptions-item>

          <el-descriptions-item label="创建方式">
            <el-tag :type="creationMethodTagType" size="small" effect="light">
              {{ creationMethodLabel }}
            </el-tag>
          </el-descriptions-item>

          <el-descriptions-item label="最后同步">
            <span v-if="repository.last_sync_at" class="sync-time">
              {{ formatDateTime(repository.last_sync_at) }}
            </span>
            <el-text v-else type="info" size="small">尚未同步</el-text>
          </el-descriptions-item>

          <el-descriptions-item label="SSH 克隆地址" :span="3">
            <el-input :model-value="repository.ssh_clone_url" readonly class="ssh-url-input">
              <template #append>
                <el-button @click="copyToClipboard(repository.ssh_clone_url)">
                  <el-icon>
                    <CopyDocument />
                  </el-icon>
                  复制
                </el-button>
              </template>
            </el-input>
          </el-descriptions-item>

          <el-descriptions-item v-if="!isLinkedRemote && repository.webhook_callback_url" label="Webhook URL" :span="3">
            <el-input :model-value="repository.webhook_callback_url" readonly class="ssh-url-input">
              <template #append>
                <el-button @click="copyToClipboard(repository.webhook_callback_url!)">
                  <el-icon>
                    <CopyDocument />
                  </el-icon>
                  复制
                </el-button>
              </template>
            </el-input>
          </el-descriptions-item>

          <el-descriptions-item v-if="!isLinkedRemote && repository.webhook_secret" label="Webhook Secret" :span="3">
            <el-input :model-value="repository.webhook_secret" readonly class="ssh-url-input">
              <template #append>
                <el-button @click="copyToClipboard(repository.webhook_secret!)">
                  <el-icon>
                    <CopyDocument />
                  </el-icon>
                  复制 Secret
                </el-button>
              </template>
            </el-input>
            <p class="secret-hint">仅本页可见，复制后填入 Webhook 的 Secret 字段。</p>
          </el-descriptions-item>

          <el-descriptions-item v-if="!isLinkedRemote && repository.deploy_key_public && !isPlatformHosted"
            label="Deploy Key 公钥" :span="3">
            <el-input :model-value="repository.deploy_key_public" readonly class="ssh-url-input">
              <template #append>
                <el-button @click="copyToClipboard(repository.deploy_key_public!)">
                  <el-icon>
                    <CopyDocument />
                  </el-icon>
                  复制公钥
                </el-button>
              </template>
            </el-input>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 同步错误信息 -->
        <el-alert v-if="repository.sync_status === 'failed' && repository.sync_error" title="同步失败" type="error"
          :description="repository.sync_error" show-icon :closable="false" class="sync-error-alert" />
      </div>

      <!-- 操作按钮区域 -->
      <div class="actions-section">
        <el-button type="success" plain :loading="committingTrans" :disabled="!can('git.sync')"
          @click="handleTransCommit" class="action-btn-main">
          <el-icon class="el-icon--left">
            <Upload />
          </el-icon>
          {{ committingTrans ? '提交中...' : '提交到账本' }}
        </el-button>
        <el-button v-if="!isLinkedRemote" type="primary" plain :loading="downloadingKey" @click="downloadDeployKey"
          class="action-btn-main">
          <el-icon class="el-icon--left">
            <Key />
          </el-icon>
          下载 Deploy Key
        </el-button>
      </div>

      <!-- 使用说明：已配置过则收成一行，按需展开 -->
      <div class="instructions-section">
        <div class="section-title-row">
          <h4 class="section-title">
            <el-icon>
              <Document />
            </el-icon>
            {{ isSetupDone ? '配置说明' : '使用说明' }}
          </h4>
          <template v-if="isSetupDone">
            <el-button link type="primary" size="small" class="section-action"
              @click="showInstructions = !showInstructions">
              {{ showInstructions ? '收起' : '查看配置说明' }}
            </el-button>
          </template>
        </div>

        <el-collapse v-if="!isSetupDone || showInstructions" v-model="instructionActivePanels">
          <!-- 关联远程：仅平台对接（与「平台创建仓库」的克隆/推送说明区分） -->
          <el-collapse-item v-if="isLinkedRemote" title="步骤 1：添加 Deploy Key 公钥（平台拉取）" name="link-deploy-key">
            <div class="instruction-content link-step-panel">
              <p>
                在 {{ providerLabel }} 的 <strong>{{ providerDeployKeyHint }}</strong>
                中粘贴下方公钥：只用来看账本就勾选只读；需要「提交到账本」写回则要给写权限。
              </p>
              <el-input v-if="repository.deploy_key_public" :model-value="repository.deploy_key_public" readonly
                class="ssh-url-input">
                <template #append>
                  <el-button @click="copyToClipboard(repository.deploy_key_public!)">
                    <el-icon>
                      <CopyDocument />
                    </el-icon>
                    复制公钥
                  </el-button>
                </template>
              </el-input>
              <el-text v-else type="warning" size="small">未返回公钥时请联系管理员或刷新页面后重试。</el-text>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="isLinkedRemote" title="步骤 2：配置 Webhook（推送后自动拉取）" name="link-webhook">
            <div class="instruction-content link-step-panel">
              <p>
                在 {{ providerLabel }} 添加 push Webhook：Payload URL 用下方地址，Content type 选
                <code>application/json</code>，Secret 填下方 Secret（仅本页可见）。
              </p>
              <el-input v-if="repository.webhook_callback_url" :model-value="repository.webhook_callback_url" readonly
                class="ssh-url-input">
                <template #append>
                  <el-button @click="copyToClipboard(repository.webhook_callback_url!)">
                    <el-icon>
                      <CopyDocument />
                    </el-icon>
                    复制 URL
                  </el-button>
                </template>
              </el-input>
              <template v-if="repository.webhook_secret">
                <el-input :model-value="repository.webhook_secret" readonly class="ssh-url-input mt-2">
                  <template #append>
                    <el-button @click="copyToClipboard(repository.webhook_secret!)">
                      <el-icon>
                        <CopyDocument />
                      </el-icon>
                      复制 Secret
                    </el-button>
                  </template>
                </el-input>
                <p class="secret-hint">
                  配好后推送到 <code>{{ defaultBranch }}</code> 即可验证：顶部状态变为「成功」。
                </p>
              </template>
              <p v-else-if="repository.webhook_callback_url" class="secret-hint">
                Secret 已不在本页显示：重新关联可获取新 Secret，或直接用「立即同步」手动拉取。
              </p>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="!isLinkedRemote" title="配置 SSH 密钥" name="ssh">
            <div class="instruction-content">
              <template v-if="isPlatformHosted">
                <p>下载 Deploy Key 后按下面示例配置 SSH，即可访问平台 Gitea。</p>
                <div class="code-block">
                  <pre><code># 设置 SSH 密钥权限
chmod 600 ~/Downloads/{{ username }}_deploy_key.pem

# 添加 SSH 配置（示例，HostName/Port 以实际部署为准）
cat >> ~/.ssh/config &lt;&lt; 'EOF'
Host gitea-beancount
        HostName gitea.dhr2333.cn
        Port 30022
        User git
        IdentityFile ~/Downloads/{{ username }}_deploy_key.pem
EOF</code></pre>
                </div>
              </template>
              <template v-else>
                <p>把私钥配到 <code>IdentityFile</code>，并把公钥加到远程仓库的 Deploy Key。</p>
              </template>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="!isLinkedRemote" title="克隆并推送账本" name="clone-push">
            <div class="instruction-content">
              <p>克隆仓库：</p>
              <div class="code-block">
                <pre><code>git clone {{ repository.ssh_clone_url }} Assets</code></pre>
              </div>
              <p v-if="isPlatformHosted">若已按上文配置 <code>Host gitea-beancount</code>，也可使用别名形式克隆。</p>
              <p>编辑账本后推送到默认分支 <code>{{ defaultBranch }}</code>：</p>
              <div class="code-block">
                <pre><code>git add .
git commit -m "更新账本"
git push origin {{ defaultBranch }}</code></pre>
              </div>
              <p>推送会触发 Webhook 同步，也可手动点「立即同步」；审核后的条目用「提交到账本」写回
                <code>{年}/{月}.bean</code>，本地 <code>git pull</code> 取回。
              </p>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 高级设置：与使用说明分离，始终可见 -->
      <div class="advanced-section">
        <el-collapse v-model="advancedActivePanels">
          <el-collapse-item name="advanced">
            <template #title>
              <div class="advanced-title">高级设置</div>
            </template>
            <div class="advanced-settings">
              <!-- 导出账本：Git 用户在此直接下载当前账本副本 -->
              <div class="setting-item first-item">
                <div class="setting-info">
                  <span class="setting-label">导出账本</span>
                  <span class="setting-desc">打包当前账本为 ZIP，可直接用 Fava 或本地 Beancount 打开</span>
                </div>
                <div class="setting-actions">
                  <el-button type="primary" plain size="small" :loading="exportingLedger" @click="handleLedgerExport">
                    <el-icon class="el-icon--left">
                      <Download />
                    </el-icon>
                    {{ exportingLedger ? '导出中...' : '导出账本' }}
                  </el-button>
                </div>
              </div>

              <div class="setting-divider"></div>

              <!-- Deploy Key 重置（平台托管 / 其他非关联远程场景） -->
              <template v-if="!isLinkedRemote">
                <div class="setting-item">
                  <div class="setting-info">
                    <span class="setting-label">重置 Deploy Key</span>
                    <span class="setting-desc">旧密钥立即失效，需重新配置 SSH</span>
                  </div>
                  <div class="setting-actions">
                    <el-popconfirm title="确定重置密钥吗？旧密钥将立即失效。" @confirm="confirmRegenerateKey" width="260">
                      <template #reference>
                        <el-button type="warning" plain size="small" :loading="regeneratingKey">
                          <el-icon class="el-icon--left">
                            <Refresh />
                          </el-icon>
                          重置 Key
                        </el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </div>

                <div class="setting-divider"></div>
              </template>

              <!-- 自动导入账本新增账户 -->
              <div class="setting-item">
                <div class="setting-info">
                  <span class="setting-label">自动导入账本新增账户</span>
                  <span class="setting-desc">
                    同步后把账本中显式 open 的新账户加入平台；不改写账本
                  </span>
                </div>
                <div class="setting-actions">
                  <el-switch :model-value="repository.auto_import_ledger_accounts" :loading="savingAutoImportSettings"
                    @change="handleAutoImportChange" />
                </div>
              </div>

              <div class="setting-divider"></div>

              <!-- 取消同步：撤回平台内的账本副本，配置保留 -->
              <template v-if="!repository.sync_paused">
                <div class="setting-item">
                  <div class="setting-info">
                    <span class="setting-label">取消同步</span>
                    <span class="setting-desc">清空平台上的账本，解析结果保留；可随时恢复同步</span>
                  </div>
                  <div class="setting-actions">
                    <el-button type="warning" plain size="small" :loading="cancellingSync" :disabled="!can('git.sync')"
                      @click="handleCancelSync">
                      取消同步
                    </el-button>
                  </div>
                </div>

                <div class="setting-divider"></div>
              </template>

              <!-- 删除仓库 -->
              <div class="setting-item">
                <div class="setting-info">
                  <span class="setting-label text-danger">{{ isLinkedRemote ? '删除同步配置' : '删除仓库' }}</span>
                  <span class="setting-desc">
                    {{ isLinkedRemote ? '删除后将停止平台与该远程仓库的同步，不会删除远程仓库中的代码' : '永久删除 Git 仓库配置，此操作不可恢复' }}
                  </span>
                </div>
                <div class="setting-actions">
                  <el-popconfirm
                    :title="isLinkedRemote ? '确定要删除同步配置吗？这将停止同步并清除平台内配置，但不会删除远程仓库中的代码。' : '确定要删除仓库吗？这将停止同步并清除配置。'"
                    @confirm="confirmDeleteRepository" width="260">
                    <template #reference>
                      <el-button type="danger" plain size="small" :loading="deletingRepository">
                        <el-icon class="el-icon--left">
                          <Delete />
                        </el-icon>
                        {{ isLinkedRemote ? '取消关联' : '删除仓库' }}
                      </el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  triggerSync as apiTriggerSync,
  handleDeployKeyDownload,
  previewTransCommit,
  commitTrans,
  pollSyncStatus,
  deleteGitRepository as apiDeleteGitRepository,
  cancelSync as apiCancelSync,
  updateGitRepositorySettings
} from '../../api/git'
import { emitGitRepositoryChanged } from '../../utils/accountEvents'
import { useCapabilities } from '../../capabilities'
import { useLedgerExport } from '../../composables/useLedgerExport'
import {
  SyncStatusText,
  SyncStatusType,
  type GitRepository,
  type LedgerCommitPreview
} from '../../types/git'

// 组件属性
const props = defineProps<{
  repository: GitRepository
}>()

// 组件事件
const emit = defineEmits<{
  updated: [repository: GitRepository]
  deleted: []
}>()

// 响应式状态
const syncing = ref(false)
const downloadingKey = ref(false)
const regeneratingKey = ref(false)
const committingTrans = ref(false)
const { can, username: capabilityUsername } = useCapabilities()
const { exporting: exportingLedger, handleExport: handleLedgerExport } = useLedgerExport()
const deletingRepository = ref(false)
const cancellingSync = ref(false)
const savingAutoImportSettings = ref(false)

// 计算属性
const username = computed(() => capabilityUsername.value || 'user')

const defaultBranch = computed(() => (props.repository.default_branch || 'main').trim() || 'main')

const isPlatformHosted = computed(
  () =>
    props.repository.provider === 'gitea_hosted' &&
    !(props.repository.remote_ssh_url || '').trim()
)

/** 关联已有远程：显式 link，或未返回 setup_mode 时由非平台托管 + SSH 地址推断 */
const isLinkedRemote = computed(() => {
  const mode = props.repository.setup_mode
  if (mode === 'link') return true
  if (mode === 'create') return false
  const url = (props.repository.remote_ssh_url || '').trim()
  return url.length > 0 && props.repository.provider !== 'gitea_hosted'
})

const creationMethodLabel = computed(() => {
  if (isLinkedRemote.value) return '关联'
  if (props.repository.created_with_template) return '模板创建'
  return '空仓库'
})

const creationMethodTagType = computed<'success' | 'warning' | 'info'>(() => {
  if (isLinkedRemote.value) return 'warning'
  if (props.repository.created_with_template) return 'success'
  return 'info'
})

/** provider 显示名，用于关联远程的引导文案 */
const providerLabel = computed(() => {
  const map: Record<string, string> = {
    gitea_hosted: '平台 Gitea',
    github: 'GitHub',
    gitlab: 'GitLab',
    gitea: 'Gitea',
    gogs: 'Gogs',
    other: '自建 Git'
  }
  return map[props.repository.provider] || map.other
})

/** 各平台 Deploy Key 的位置提示 */
const providerDeployKeyHint = computed(() => {
  const map: Record<string, string> = {
    github: 'Settings → Deploy keys',
    gitlab: 'Settings → Repository → Deploy keys',
    gitea: 'Settings → Deploy Keys',
    gogs: 'Settings → Deploy Keys',
    other: '仓库设置中的 Deploy Keys / 部署公钥'
  }
  return map[props.repository.provider] || map.other
})

const instructionActivePanels = ref<string[]>([])
const advancedActivePanels = ref<string[]>([])

/** 已成功同步过，视为完成配置：使用说明收成一行，避免已完成用户被步骤长期占据版面 */
const isSetupDone = computed(() => Boolean(props.repository.last_sync_at))
const showInstructions = ref(false)

/** 使用说明默认状态：未完成配置时展开当前路径的操作步骤，已完成则全部收起 */
watch(
  [isLinkedRemote, isSetupDone],
  ([linked, done]) => {
    if (done) {
      instructionActivePanels.value = []
      showInstructions.value = false
      return
    }
    instructionActivePanels.value = linked
      ? ['link-deploy-key', 'link-webhook']
      : ['ssh', 'clone-push']
  },
  { immediate: true }
)

// 工具方法
const getSyncIcon = (status: string) => {
  const iconMap = {
    'pending': 'Clock',
    'syncing': 'Loading',
    'success': 'Check',
    'failed': 'Close',
    'paused': 'VideoPause'
  }
  return iconMap[status as keyof typeof iconMap]
}

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    ElMessage.success('已复制到剪贴板')
  }
}

// API 方法
const triggerSync = async () => {
  syncing.value = true

  try {
    const response = await apiTriggerSync()
    const importedCount = response.imported_accounts?.length ?? 0
    ElMessage.success(
      importedCount > 0
        ? `${response.message}（自动导入 ${importedCount} 个账户）`
        : response.message
    )

    // 开始轮询状态
    await pollSyncStatus((status) => {
      // 更新本地状态
      const updatedRepo = {
        ...props.repository,
        sync_status: status.status,
        last_sync_at: status.last_sync_at,
        sync_error: status.error || '',
        // 手动同步会解除「取消同步」，需同步回填以恢复按钮文案
        sync_paused: status.paused
      }
      emit('updated', updatedRepo)
    })

  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      const message = axiosError.response?.data?.error || '同步失败，请稍后重试'
      ElMessage.error(message)
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    syncing.value = false
  }
}

/**
 * 切换「自动导入账本新增账户」开关
 */
const handleAutoImportChange = async (value: string | number | boolean) => {
  const enabled = Boolean(value)
  savingAutoImportSettings.value = true

  try {
    const repo = await updateGitRepositorySettings({
      auto_import_ledger_accounts: enabled
    })
    emit('updated', repo)
    ElMessage.success(enabled ? '已开启自动导入账本新增账户' : '已关闭自动导入账本新增账户')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      ElMessage.error(axiosError.response?.data?.error || '设置保存失败，请稍后重试')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    savingAutoImportSettings.value = false
  }
}

/**
 * 取消同步：清除服务器本地账本副本并暂停自动拉取
 */
const handleCancelSync = async () => {
  try {
    await ElMessageBox.confirm(
      '取消后平台上的账本会被清空（解析结果保留），远端推送也不再自动同步；随时可点「恢复同步」重新拉取。',
      '取消同步',
      { confirmButtonText: '取消同步', cancelButtonText: '返回', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  cancellingSync.value = true
  try {
    const result = await apiCancelSync()
    ElMessage.success(
      result.trans_preserved
        ? `${result.message}（已保留解析结果）`
        : result.message
    )
    emit('updated', { ...props.repository, sync_paused: true })
    emitGitRepositoryChanged()
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      ElMessage.error(axiosError.response?.data?.error || '取消同步失败，请稍后重试')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    cancellingSync.value = false
  }
}

/**
 * 构建迁移预览的 HTML 摘要（用于确认弹窗）
 */
const buildCommitPreviewHtml = (preview: LedgerCommitPreview): string => {
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const header = `共扫描 <b>${preview.files_scanned}</b> 个文件、<b>${preview.total_entries}</b> 条条目：`
  const rows = preview.plans
    .map(
      (plan) =>
        `<li>${escape(plan.target)}：<b>${plan.count}</b> 条</li>`
    )
    .join('')
  return (
    `<div style="line-height:1.7">${header}` +
    `<ul style="padding-left:18px;margin:8px 0">${rows}</ul>` +
    `<span style="color:var(--el-text-color-secondary);font-size:12px">提交后 trans/ 中的条目将被清空，且会推送到远程仓库，无法撤销。</span></div>`
  )
}

/**
 * 提交 trans/ 条目到月度账本：预览 → 确认 → 提交并推送
 */
const handleTransCommit = async () => {
  committingTrans.value = true

  try {
    const preview = await previewTransCommit()

    if (preview.errors?.length) {
      ElMessage.error(`存在无法解析的文件：${preview.errors[0].file}`)
      return
    }
    if (!preview.plans.length) {
      ElMessage.info('暂无可提交条目：审核通过的条目才会进入 trans/')
      return
    }

    try {
      await ElMessageBox.confirm(
        buildCommitPreviewHtml(preview),
        '确认提交到月度账本',
        {
          confirmButtonText: '提交并推送',
          cancelButtonText: '取消',
          type: 'warning',
          dangerouslyUseHTMLString: true
        }
      )
    } catch {
      return // 用户取消
    }

    const result = await commitTrans()
    ElMessage.success(`${result.message}（写入 ${result.entries_appended} 条）`)
    emitGitRepositoryChanged()
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      ElMessage.error(axiosError.response?.data?.error || '提交失败，请稍后重试')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    committingTrans.value = false
  }
}

const downloadDeployKey = async () => {
  downloadingKey.value = true

  try {
    const result = await handleDeployKeyDownload(false)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } finally {
    downloadingKey.value = false
  }
}

const confirmRegenerateKey = async () => {
  regeneratingKey.value = true

  try {
    const result = await handleDeployKeyDownload(true)
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    // handle error
    console.error(error)
  } finally {
    regeneratingKey.value = false
  }
}

// 删除仓库相关方法
const confirmDeleteRepository = async () => {
  await deleteRepository()
}

const deleteRepository = async () => {
  deletingRepository.value = true

  try {
    const response = await apiDeleteGitRepository()
    ElMessage.success('仓库删除成功')
    emitGitRepositoryChanged()

    // 通知父组件仓库已删除
    emit('deleted')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      const message = axiosError.response?.data?.error || '仓库删除失败，请稍后重试'
      ElMessage.error(message)
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    deletingRepository.value = false
  }
}
</script>

<style scoped lang="scss">
.git-repository {
  max-width: 900px;
  margin: 0 auto;
}

.repo-card {
  margin-bottom: 20px;
}

// Header Styles
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .header-icon {
        color: var(--el-color-success);
        font-size: 20px;
      }

      .title {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

// Info Section Styles
.repo-info-section {
  margin-bottom: 24px;
}

.field-hint-below {
  display: block;
  margin-top: 8px;
  line-height: 1.5;
}

.repo-descriptions {
  :deep(.el-descriptions__label) {
    width: 120px;
  }
}

.repo-name {
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.sync-time {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.ssh-url-input {
  :deep(.el-input__inner) {
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }
}

.sync-error-alert {
  margin-top: 16px;
}

.secret-hint {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

// Actions Section Styles
.actions-section {
  padding-bottom: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 24px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn-main {
  @media (max-width: 640px) {
    width: 100%;
  }
}

// Advanced Settings Styles
.advanced-title {
  display: flex;
  align-items: center;
}

.mr-2 {
  margin-right: 8px;
}

.advanced-settings {
  padding: 8px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;

  &.first-item {
    padding-top: 4px;
  }

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .setting-actions {
      width: 100%;
      display: flex;
      justify-content: flex-end;
    }
  }
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 24px;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);

  &.text-danger {
    color: var(--el-color-danger);
  }
}

.setting-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.setting-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
}

.setting-divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 12px 0;
}

// Instructions Styles
.mono-text {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.mt-2 {
  margin-top: 8px;
}

.instructions-section {
  .section-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .section-action {
    margin-left: auto;
    flex-shrink: 0;
  }
}

.advanced-section {
  margin-top: 16px;
}

.instruction-content {
  padding: 0 8px;

  p {
    margin: 0 0 12px 0;
    line-height: 1.6;
    color: var(--el-text-color-regular);
  }
}

.link-platform-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.55;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.code-block {
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid var(--el-border-color-lighter);

  pre {
    margin: 0;
    overflow-x: auto;
    font-family: 'Monaco', 'Consolas', monospace;

    code {
      font-family: inherit;
      font-size: 13px;
      line-height: 1.6;
      color: var(--el-text-color-primary);
      background-color: transparent;
      display: block;
      white-space: pre;
    }
  }
}

// Responsive
@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .header-right {
      width: 100%;
      justify-content: space-between;
    }
  }
}
</style>
