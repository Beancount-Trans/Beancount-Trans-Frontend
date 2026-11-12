<template>
  <div class="git-setup">
    <!-- 启用入口 -->
    <el-card v-if="step === 'intro'" shadow="never" class="intro-card">
      <template #header>
        <div class="card-header">
          <el-icon class="header-icon">
            <Connection />
          </el-icon>
          <div>
            <div class="title-row">
              <h3>启用 Git 同步</h3>
              <el-tag size="small" type="info" effect="plain">高级 · 可选</el-tag>
            </div>
            <el-text type="info" size="small">账本自己管、平台只读的高级选项。</el-text>
          </div>
        </div>
      </template>

      <div class="intro-content">
        <ul class="change-list">
          <li><strong>账户以账本为准</strong>：路径、币种、删除都在账本里维护，平台只做核对。</li>
          <li><strong>写入分两步</strong>：解析结果要点「提交到账本」才写回仓库。</li>
          <li><strong>仓库自备</strong>：关联已有 SSH 仓库，或由平台在 Gitea 新建。</li>
        </ul>

        <div class="action-buttons">
          <el-button type="primary" size="large" :loading="loading" @click="confirmEnable">
            <el-icon>
              <Plus />
            </el-icon>
            启用 Git 同步
          </el-button>
          <el-link type="primary" :href="gitSyncDocUrl" target="_blank" rel="noopener" class="doc-link">
            查看配置文档
          </el-link>
        </div>

      </div>
    </el-card>

    <!-- 第一层：关联 vs 创建 -->
    <el-card v-else-if="step === 'path'" shadow="never" class="options-card">
      <template #header>
        <div class="card-header">
          <div>
            <h3>关联或创建仓库</h3>
            <el-text type="info" size="small">关联已有远程，或由平台代建仓库</el-text>
          </div>
        </div>
      </template>

      <div class="options-content">
        <div class="option-cards path-cards">
          <el-card class="option-card path-card" :body-style="{ padding: '20px' }" shadow="hover" @click="goLinkForm">
            <div class="option-header">
              <el-icon class="option-icon template-icon">
                <Link />
              </el-icon>
              <div class="option-titles">
                <h4>关联已有远程</h4>
                <el-tag type="warning" size="small">已有 SSH 仓库</el-tag>
              </div>
            </div>
            <p class="path-desc">填入 SSH 克隆地址，再按步骤配置公钥与 Webhook。</p>
          </el-card>

          <el-card class="option-card path-card" :body-style="{ padding: '20px' }" shadow="hover"
            @click="goHostedTemplates">
            <div class="option-header">
              <el-icon class="option-icon template-icon">
                <FolderAdd />
              </el-icon>
              <div class="option-titles">
                <h4>使用平台创建仓库</h4>
                <el-tag type="success" size="small">Gitea</el-tag>
              </div>
            </div>
            <p class="path-desc">平台在 Gitea 建私有仓库，可选模板或空库。</p>
          </el-card>
        </div>

        <div class="action-buttons">
          <el-button size="large" @click="backToIntro">返回</el-button>
        </div>
      </div>
    </el-card>

    <!-- 关联表单 -->
    <el-card v-else-if="step === 'linkForm'" shadow="never" class="options-card">
      <template #header>
        <div class="card-header">
          <div>
            <h3>关联远程仓库</h3>
            <el-text type="info" size="small">仅支持 SSH 地址（git@… 或 ssh://…）</el-text>
          </div>
        </div>
      </template>

      <div class="form-wrap">
        <el-alert type="warning" :closable="false" show-icon title="关联前：账本需满足三处条件" class="ledger-adapt-alert">
          <ul class="notice-list">
            <li>仓库根目录需有入口文件 <code>main.bean</code></li>
            <li><code>main.bean</code> 中需包含 <code>include "trans/main.bean"</code></li>
            <li><code>.gitignore</code> 中需包含 <code>trans/</code></li>
          </ul>
          <el-text type="info" size="small">
            详见
            <a :href="gitSyncDocUrl" target="_blank" rel="noopener">「配置 Git 同步」文档</a>。
          </el-text>
        </el-alert>

        <el-form label-position="top" class="external-form">
          <el-form-item label="SSH 地址" required>
            <el-input v-model="linkForm.remote_ssh_url" placeholder="git@github.com:owner/repo.git" clearable />
          </el-form-item>
          <el-form-item label="平台">
            <el-select v-model="linkForm.provider" placeholder="自动识别" clearable>
              <el-option label="自动识别（推荐）" value="" />
              <el-option label="GitHub" value="github" />
              <el-option label="GitLab" value="gitlab" />
              <el-option label="Gitea" value="gitea" />
              <el-option label="Gogs" value="gogs" />
              <el-option label="其他 / 自建" value="other" />
            </el-select>
            <el-text type="info" size="small" class="field-hint">
              留空自动识别；识别不准再手动指定。
            </el-text>
          </el-form-item>
          <el-collapse class="link-advanced-collapse">
            <el-collapse-item title="高级选项（一般无需填写）" name="advanced">
              <el-form-item label="仓库全名" class="advanced-form-item">
                <el-input v-model="linkForm.external_full_name" placeholder="owner/repo；留空则由平台从 SSH 地址解析" clearable />
                <el-text type="info" size="small" class="field-hint">
                  用于与 Webhook 载荷中的仓库路径匹配；仅当地址无法解析时再填。
                </el-text>
              </el-form-item>
            </el-collapse-item>
          </el-collapse>
        </el-form>
        <div class="action-buttons">
          <el-button size="large" @click="backToPath">返回</el-button>
          <el-button type="primary" size="large" :loading="loading" @click="submitLink">关联远程仓库</el-button>
        </div>
      </div>
    </el-card>

    <!-- 平台 Gitea：模板选择 -->
    <el-card v-else-if="step === 'hostedTemplates'" shadow="never" class="options-card">
      <template #header>
        <div class="card-header">
          <div>
            <h3>平台仓库初始化</h3>
            <el-text type="info" size="small">选择是否在托管仓库中预置模板</el-text>
          </div>
        </div>
      </template>

      <div class="options-content">
        <div class="option-cards">
          <el-card :class="['option-card', { selected: selectedOption === true }]" :body-style="{ padding: '20px' }"
            @click="selectOption(true)">
            <div class="option-header">
              <el-icon class="option-icon template-icon">
                <DocumentAdd />
              </el-icon>
              <div class="option-titles">
                <h4>基于模板创建</h4>
                <el-tag type="success" size="small">推荐新手</el-tag>
              </div>
              <el-radio :model-value="radioModelValue" label="template" @click.stop />
            </div>
            <p class="path-desc">含标准目录、账户体系与示例文件，开箱即用。</p>
          </el-card>

          <el-card :class="['option-card', { selected: selectedOption === false }]" :body-style="{ padding: '20px' }"
            @click="selectOption(false)">
            <div class="option-header">
              <el-icon class="option-icon empty-icon">
                <Folder />
              </el-icon>
              <div class="option-titles">
                <h4>空仓库创建</h4>
                <el-tag type="info" size="small">推荐迁移用户</el-tag>
              </div>
              <el-radio :model-value="radioModelValue" label="empty" @click.stop />
            </div>
            <p class="path-desc">建空仓库，等您推送现有账本。</p>
          </el-card>
        </div>

        <el-alert v-if="selectedOption === false" type="warning" :closable="false" show-icon title="关联前：账本需满足三处条件"
          class="ledger-adapt-alert">
          <ul class="notice-list">
            <li>仓库根目录需有入口文件 <code>main.bean</code></li>
            <li><code>main.bean</code> 中需包含 <code>include "trans/main.bean"</code></li>
            <li><code>.gitignore</code> 中需包含 <code>trans/</code></li>
          </ul>
          <el-text type="info" size="small">
            详见
            <a :href="gitSyncDocUrl" target="_blank" rel="noopener">「配置 Git 同步」文档</a>。
          </el-text>
        </el-alert>

        <div class="action-buttons">
          <el-button size="large" @click="backToPathFromHosted">返回</el-button>
          <el-button type="primary" size="large" :loading="loading" :disabled="selectedOption === undefined"
            @click="submitCreateHosted">
            <el-icon>
              <Check />
            </el-icon>
            创建仓库
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createGitRepository, linkGitRepository } from '../../api/git'
import type { GitProvider, GitRepository } from '../../types/git'
import { emitGitRepositoryChanged } from '../../utils/accountEvents'

defineProps<{}>()

const emit = defineEmits<{
  created: [repository: GitRepository]
}>()

type Step =
  | 'intro'
  | 'path'
  | 'linkForm'
  | 'hostedTemplates'

const step = ref<Step>('intro')
const loading = ref(false)
const selectedOption = ref<boolean | undefined>(undefined)

const gitSyncDocUrl =
  'https://trans.dhr2333.cn/docs/%E6%93%8D%E4%BD%9C%E6%8C%87%E5%8D%97/git-sync/'

interface LinkForm {
  remote_ssh_url: string
  provider: GitProvider | ''
  default_branch: string
  external_full_name: string
}

const linkForm = ref<LinkForm>({
  remote_ssh_url: '',
  provider: '',
  default_branch: 'main',
  external_full_name: ''
})

const radioModelValue = computed<string | undefined>(() => {
  if (selectedOption.value === true) return 'template'
  if (selectedOption.value === false) return 'empty'
  return undefined
})

/** 启用前二次确认：明确告知启用后账本管理方式的变化 */
const confirmEnable = async () => {
  try {
    await ElMessageBox.confirm(
      '启用后改为以账本为准管理账户，解析结果也需手动「提交到账本」，并要在远程配置公钥与 Webhook。确定继续？',
      '启用 Git 同步',
      { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  goPath()
}

const goPath = () => {
  step.value = 'path'
}

const backToIntro = () => {
  step.value = 'intro'
  resetForms()
}

const backToPath = () => {
  step.value = 'path'
  resetForms()
}

const goLinkForm = () => {
  step.value = 'linkForm'
}

const goHostedTemplates = () => {
  step.value = 'hostedTemplates'
  selectedOption.value = undefined
}

const backToPathFromHosted = () => {
  step.value = 'path'
  selectedOption.value = undefined
}

const resetForms = () => {
  selectedOption.value = undefined
  linkForm.value = {
    remote_ssh_url: '',
    provider: '',
    default_branch: 'main',
    external_full_name: ''
  }
}

const selectOption = (option: boolean) => {
  selectedOption.value = option
}

const pickErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const r = error as {
      response?: { data?: { error?: string;[field: string]: unknown } }
    }
    const data = r.response?.data
    if (data) {
      const msg = data.error
      if (typeof msg === 'string' && msg) return msg
      // DRF 字段级校验错误，如 { remote_ssh_url: ["请填写 SSH 格式的仓库地址..."] }
      for (const value of Object.values(data)) {
        if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) return value[0]
        if (typeof value === 'string' && value) return value
      }
    }
  }
  return fallback
}

const submitLink = async () => {
  const url = linkForm.value.remote_ssh_url.trim()
  if (!url) {
    ElMessage.warning('请填写 SSH 地址')
    return
  }
  loading.value = true
  try {
    const repository = await linkGitRepository({
      remote_ssh_url: url,
      provider: linkForm.value.provider,
      default_branch: linkForm.value.default_branch.trim() || 'main',
      external_full_name: linkForm.value.external_full_name.trim()
    })
    ElMessage.success(
      '关联成功。请在下方「Git 仓库管理」中复制 Webhook 与公钥，并完成远程仓库配置；Webhook Secret 仅首次展示，请立即保存。'
    )
    emitGitRepositoryChanged()
    emit('created', repository)
  } catch (error: unknown) {
    ElMessage.error(pickErrorMessage(error, '关联失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}

const submitCreateHosted = async () => {
  if (selectedOption.value === undefined) {
    ElMessage.warning('请选择创建方式')
    return
  }
  loading.value = true
  try {
    const repository = await createGitRepository({ template: selectedOption.value })
    ElMessage.success('Git 仓库创建成功！')
    emitGitRepositoryChanged()
    emit('created', repository)
  } catch (error: unknown) {
    ElMessage.error(pickErrorMessage(error, '创建失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.git-setup {
  max-width: 800px;
  margin: 0 auto;
}

.intro-card,
.options-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: var(--action);
  font-size: 24px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.intro-content {
  padding: 0 8px;
}

.change-list {
  margin: 0 0 8px;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.change-list li {
  margin-bottom: 6px;
}

.doc-link {
  font-size: 14px;
  align-self: center;
}

.exit-note {
  display: block;
  margin-bottom: 16px;
}

.ledger-adapt-alert {
  margin-bottom: 16px;
}

.notice-list {
  margin: 0;
  padding-left: 16px;
  text-align: left;
}

.notice-list li {
  margin-bottom: 4px;
  font-size: 13px;
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.options-content {
  padding: 0 8px;
}

.form-wrap {
  padding: 0 8px 8px;
}

.external-form {
  max-width: 560px;
  margin: 0 auto 8px;
}

.link-advanced-collapse {
  margin-top: 8px;
  border: none;

  :deep(.el-collapse-item__header),
  :deep(.el-collapse-item__header) {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  :deep(.el-collapse-item__wrap),
  :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }
}

.advanced-form-item {
  margin-bottom: 0;
}

.field-hint {
  display: block;
  margin-top: 6px;
  line-height: 1.5;
}

.path-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.path-cards {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.path-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.path-card:hover {
  border-color: var(--el-border-color-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.option-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 16px;
}

.option-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.option-card:hover {
  border-color: var(--el-border-color-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.option-card.selected {
  border-color: var(--action);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--action) 20%, transparent);
}

.option-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.option-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.template-icon {
  color: var(--action);
}

.empty-icon {
  color: var(--text-secondary);
}

.option-titles {
  flex: 1;
}

.option-titles h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .option-cards {
    grid-template-columns: 1fr;
  }

  .action-buttons .el-button {
    width: 100%;
    max-width: 240px;
  }
}
</style>
