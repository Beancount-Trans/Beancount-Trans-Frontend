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
            <el-text type="info" size="small" class="subtitle">管理您的 Git 仓库和同步设置</el-text>
          </div>
          <div class="header-right">
            <el-tag :type="repository.sync_paused ? SyncStatusType.paused : SyncStatusType[repository.sync_status]"
              :icon="getSyncIcon(repository.sync_paused ? 'paused' : repository.sync_status)" effect="plain">
              {{ repository.sync_paused ? SyncStatusText.paused : SyncStatusText[repository.sync_status] }}
            </el-tag>
            <el-button type="primary" link :loading="syncing"
              :disabled="repository.sync_status === 'syncing' || !can('git.sync')" @click="triggerSync">
              <el-icon class="el-icon--left"><Refresh /></el-icon>
              {{ syncing ? '同步中...' : (repository.sync_paused ? '恢复同步' : '立即同步') }}
            </el-button>
            <el-button v-if="!repository.sync_paused" type="warning" link :loading="cancellingSync"
              :disabled="!can('git.sync')" @click="handleCancelSync">
              <el-icon class="el-icon--left"><CircleClose /></el-icon>
              {{ cancellingSync ? '清理中...' : '取消同步' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 仓库信息 -->
      <div class="repo-info-section">
        <el-alert v-if="isLinkedRemote && showLinkedRemoteIntro" type="info" show-icon :closable="false"
          class="linked-remote-intro">
          <template #title>关联远程：完成平台侧对接</template>
          <p class="linked-intro-text">
            请按顺序展开下方<strong>步骤 1、步骤 2</strong>，在托管平台配置公钥与 Webhook。本地 Git 的克隆由您自行完成；平台从该远程仓库拉取账本。若要让平台把审核后的条目写回仓库，请使用
            <strong>「提交到账本」</strong>（需给该公钥写权限）。
          </p>
          <el-text type="warning" size="small" class="mt-2">
            Webhook Secret 仅首次展示，请务必及时复制保存。刷新或重新进入页面后通常不再显示。如丢失请删除仓库后重新关联。
          </el-text>
        </el-alert>

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
                  <el-icon><CopyDocument /></el-icon>
                  复制
                </el-button>
              </template>
            </el-input>
          </el-descriptions-item>

          <el-descriptions-item v-if="!isLinkedRemote && repository.webhook_callback_url" label="Webhook URL" :span="3">
            <el-input :model-value="repository.webhook_callback_url" readonly class="ssh-url-input">
              <template #append>
                <el-button @click="copyToClipboard(repository.webhook_callback_url!)">
                  <el-icon><CopyDocument /></el-icon>
                  复制
                </el-button>
              </template>
            </el-input>
          </el-descriptions-item>

          <el-descriptions-item v-if="!isLinkedRemote && repository.webhook_secret" label="Webhook Secret" :span="3">
            <el-alert type="warning" :closable="false" show-icon class="webhook-secret-alert" title="仅首次展示，请立即复制保存"
              description="填入远程 Webhook 的 Secret / Token / 密钥字段。刷新或重新进入页面后通常不再显示；若未保存，可删除本 Git 仓库重新关联。" />
            <el-input :model-value="repository.webhook_secret" readonly class="ssh-url-input mt-2" />
            <el-button class="mt-2" size="small" type="primary" plain
              @click="copyToClipboard(repository.webhook_secret!)">
              <el-icon><CopyDocument /></el-icon>
              复制 Secret
            </el-button>
          </el-descriptions-item>

          <el-descriptions-item v-if="!isLinkedRemote && repository.deploy_key_public && !isPlatformHosted"
            label="Deploy Key 公钥" :span="3">
            <el-input type="textarea" :rows="3" :model-value="repository.deploy_key_public" readonly
              class="ssh-url-input" />
            <el-button class="mt-2" size="small" @click="copyToClipboard(repository.deploy_key_public!)">
              <el-icon><CopyDocument /></el-icon>
              复制公钥
            </el-button>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="repository.setup_instructions?.length && !isLinkedRemote" class="setup-hints">
          <h4 class="section-title small-title">
            <el-icon><InfoFilled /></el-icon>
            Webhook 与远程配置提示
          </h4>
          <ul class="hint-list">
            <li v-for="(line, idx) in repository.setup_instructions" :key="idx">{{ line }}</li>
          </ul>
        </div>

        <!-- 同步错误信息 -->
        <el-alert v-if="repository.sync_status === 'failed' && repository.sync_error" title="同步失败" type="error"
          :description="repository.sync_error" show-icon :closable="false" class="sync-error-alert" />
      </div>

      <!-- 操作按钮区域 -->
      <div class="actions-section">
        <el-button type="success" plain :loading="committingTrans" :disabled="!can('git.sync')"
          @click="handleTransCommit" class="action-btn-main">
          <el-icon class="el-icon--left"><Upload /></el-icon>
          {{ committingTrans ? '提交中...' : '提交到账本' }}
        </el-button>
        <el-button v-if="!isLinkedRemote" type="primary" plain :loading="downloadingKey" @click="downloadDeployKey"
          class="action-btn-main">
          <el-icon class="el-icon--left"><Key /></el-icon>
          下载 Deploy Key
        </el-button>
      </div>

      <!-- 使用说明 -->
      <div class="instructions-section">
        <h4 class="section-title">
          <el-icon><Document /></el-icon>
          使用说明
        </h4>

        <el-collapse v-model="instructionActivePanels">
          <!-- 关联远程：仅平台对接（与「平台创建仓库」的克隆/推送说明区分） -->
          <el-collapse-item v-if="isLinkedRemote" title="步骤 1：添加 Deploy Key 公钥（平台拉取）" name="link-deploy-key">
            <div class="instruction-content link-step-panel">
              <p>平台通过 Deploy Key 公钥从您的远程仓库拉取账本，与您在本地执行 <code>git push</code> 时使用的账户或 SSH
                密钥<strong>无关</strong>。</p>
              <p>在远程仓库（{{ providerLabel }}）的 <strong>{{ providerDeployKeyHint }}</strong>
                中粘贴下方公钥，并勾选<strong>只读</strong>。</p>
              <template v-if="repository.deploy_key_public">
                <el-input type="textarea" :rows="4" :model-value="repository.deploy_key_public" readonly
                  class="ssh-url-input" />
                <el-button class="mt-2" size="small" type="primary" plain
                  @click="copyToClipboard(repository.deploy_key_public!)">
                  <el-icon><CopyDocument /></el-icon>
                  复制公钥
                </el-button>
              </template>
              <el-text v-else type="warning" size="small">未返回公钥时请联系管理员或刷新页面后重试。</el-text>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="isLinkedRemote" title="步骤 2：配置 Webhook（推送后自动拉取）" name="link-webhook">
            <div class="instruction-content link-step-panel">
              <p>
                在远程仓库（{{ providerLabel }}）的 Webhooks 设置中新增一条 push 事件：<strong>Payload URL</strong> 使用下方地址；<strong>Content
                  type</strong>
                选择
                <code>application/json</code>；事件勾选 push。将平台提供的 Secret 填入 Secret / Token 字段（GitLab 为
                <strong>Secret token</strong>，GitHub / Gitea / Gogs 为 <strong>Secret</strong>）。
              </p>
              <p>
                仅当推送分支为默认分支 <code>{{ defaultBranch }}</code> 时，平台才会执行拉取；也可随时使用页头的 <strong>立即同步</strong> 手动拉取。
              </p>
              <template v-if="repository.webhook_callback_url">
                <p class="mono-label">Webhook URL</p>
                <el-input :model-value="repository.webhook_callback_url" readonly class="ssh-url-input">
                  <template #append>
                    <el-button @click="copyToClipboard(repository.webhook_callback_url!)">
                      <el-icon><CopyDocument /></el-icon>
                      复制
                    </el-button>
                  </template>
                </el-input>
              </template>
              <template v-if="repository.webhook_secret">
                <el-alert type="warning" :closable="false" show-icon class="webhook-secret-alert mt-2"
                  title="Webhook Secret 仅首次展示，请立即复制保存"
                  description="刷新或重新进入页面后通常不再显示。若未保存，需删除本 Git 配置后重新关联，并在远程更新 Webhook。" />
                <el-input :model-value="repository.webhook_secret" readonly class="ssh-url-input mt-2" />
                <el-button class="mt-2" size="small" type="primary" plain
                  @click="copyToClipboard(repository.webhook_secret!)">
                  <el-icon><CopyDocument /></el-icon>
                  复制 Secret
                </el-button>
              </template>
              <p v-else-if="repository.webhook_callback_url" class="secret-missing-hint">
                若此处未显示 Secret，可能已刷新过页面；请在远程仓库中按文档更新密钥，或删除仓库后重新关联以获取新 Secret。
              </p>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="!isLinkedRemote" title="配置 SSH 密钥" name="ssh">
            <div class="instruction-content">
              <template v-if="isPlatformHosted">
                <p>下载 Deploy Key 后，需要配置 SSH 以访问平台 Gitea：</p>
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
                <p>下载 Deploy Key 私钥后，在本地配置 <code>IdentityFile</code> 指向该文件，或使用 <code>ssh-agent</code> 加载密钥，确保能访问上方「SSH
                  克隆地址」。</p>
                <p>在 GitHub 仓库设置中添加 Deploy Key，并粘贴「Deploy Key 公钥」。</p>
              </template>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="!isLinkedRemote" title="克隆仓库到本地" name="clone">
            <div class="instruction-content">
              <p>使用 SSH 克隆地址：</p>
              <div class="code-block">
                <pre><code>git clone {{ repository.ssh_clone_url }} Assets</code></pre>
              </div>
              <p v-if="isPlatformHosted">若已按上文配置 <code>Host gitea-beancount</code>，也可使用别名形式克隆。</p>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="!isLinkedRemote" title="推送与同步" name="push">
            <div class="instruction-content">
              <p>编辑账本后推送到默认分支 <code>{{ defaultBranch }}</code>：</p>
              <div class="code-block">
                <pre><code>git add .
              git commit -m "更新账本"
              git push origin {{ defaultBranch }}</code></pre>
              </div>
              <p v-if="repository.webhook_callback_url"><strong>Webhook：</strong>推送至上述分支且远程已配置 Webhook
                后，平台会尝试自动拉取；也可手动点击「立即同步」。</p>
              <p v-else><strong>注意：</strong>平台托管仓库由 Gitea 触发同步；您也可随时使用「立即同步」。</p>
              <p><strong>提交到账本：</strong>平台审核通过的条目可用操作区的「提交到账本」写回
                <code>{年}/{月}.bean</code> 并推送，本地 <code>git pull</code> 取回。
              </p>
            </div>
          </el-collapse-item>

          <!-- 高级设置 -->
          <el-collapse-item name="advanced">
            <template #title>
              <div class="advanced-title">
                高级设置
                <el-text type="info" size="small" class="ml-2">
                  （{{ isLinkedRemote ? '账户导入、删除同步配置' : 'Deploy Key 重置、账户导入、删除仓库' }}）
                </el-text>
              </div>
            </template>
            <div class="advanced-settings">
              <!-- Deploy Key 重置（平台托管 / 其他非关联远程场景） -->
              <template v-if="!isLinkedRemote">
                <div class="setting-item first-item">
                  <div class="setting-info">
                    <span class="setting-label">重置 Deploy Key</span>
                    <span class="setting-desc">重置后旧密钥将失效，需要重新配置 SSH 访问</span>
                  </div>
                  <div class="setting-actions">
                    <el-popconfirm title="确定重置密钥吗？旧密钥将立即失效。" @confirm="confirmRegenerateKey" width="260">
                      <template #reference>
                        <el-button type="warning" plain size="small" :loading="regeneratingKey">
                          <el-icon class="el-icon--left"><Refresh /></el-icon>
                          重置 Key
                        </el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </div>

                <div class="setting-divider"></div>
              </template>

              <!-- 自动导入账本新增账户 -->
              <div class="setting-item" :class="{ 'first-item': isLinkedRemote }">
                <div class="setting-info">
                  <span class="setting-label">自动导入账本新增账户</span>
                  <span class="setting-desc">
                    同步后把账本中显式 open、平台缺失的账户加入平台；只新增账户，不推断币种、不改写账本
                  </span>
                </div>
                <div class="setting-actions">
                  <el-switch :model-value="repository.auto_import_ledger_accounts" :loading="savingAutoImportSettings"
                    @change="handleAutoImportChange" />
                </div>
              </div>

              <div class="setting-divider"></div>

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
                        <el-icon class="el-icon--left"><Delete /></el-icon>
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
import { ref, computed, watch, onBeforeUnmount } from 'vue'
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

/** 关联远程顶部引导：每个仓库 id 仅首次进入时展示，之后写入 localStorage 不再出现 */
const showLinkedRemoteIntro = ref(false)

function linkedRemoteIntroStorageKey(repoId: number): string {
  const u = username.value || 'anon'
  return `git_linked_remote_intro_seen_${u}_${repoId}`
}

/**
 * 必须在「根据 storage 设置 showLinkedRemoteIntro」的 watch 之前注册。
 * 否则后者 immediate 会把 ref 直接设为 true，本 watch 看不到 false→true，永远不会写入 localStorage。
 */
watch(
  showLinkedRemoteIntro,
  (show) => {
    if (!show || !isLinkedRemote.value || !props.repository.id) return
    const key = linkedRemoteIntroStorageKey(props.repository.id)
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  },
  { immediate: true }
)

watch(
  () => [isLinkedRemote.value, props.repository.id] as const,
  ([linked, repoId]) => {
    if (!linked || !repoId) {
      showLinkedRemoteIntro.value = false
      return
    }
    const key = linkedRemoteIntroStorageKey(repoId)
    showLinkedRemoteIntro.value = !localStorage.getItem(key)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (
    showLinkedRemoteIntro.value &&
    isLinkedRemote.value &&
    props.repository.id
  ) {
    localStorage.setItem(
      linkedRemoteIntroStorageKey(props.repository.id),
      '1'
    )
  }
})

/** 关联远程：使用说明默认全部折叠 */
watch(
  isLinkedRemote,
  (linked) => {
    if (linked) {
      instructionActivePanels.value = []
    }
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
      '将删除服务器本地由 Git 同步引入的账本内容（模板账本与您推送的账本），' +
      '保留平台解析结果 trans/。Git 同步配置保持不变，取消后远端推送不再自动拉取，' +
      '点击「恢复同步」可重新拉取。',
      '确认取消同步',
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
        ? `${result.message}（已保留 trans/ 解析结果）`
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
      ElMessage.info('trans/ 下没有可迁移的条目')
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

.linked-remote-intro {
  margin-bottom: 16px;

  .linked-intro-text {
    margin: 0;
    line-height: 1.6;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
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

.webhook-secret-alert {
  margin-bottom: 8px;
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

.ml-2 {
  margin-left: 8px;
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
.setup-hints {
  margin: 16px 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.hint-list {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
}

.mono-text {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.small-title {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.mt-2 {
  margin-top: 8px;
}

.instructions-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.instruction-content {
  padding: 0 8px;

  p {
    margin: 0 0 12px 0;
    line-height: 1.6;
    color: var(--el-text-color-regular);
  }
}

.link-step-panel {
  .mono-label {
    margin: 12px 0 6px 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }

  .secret-missing-hint {
    margin: 8px 0 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
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
