<template>
  <div class="git-setup">
    <!-- Git 功能介绍 -->
    <el-card v-if="step === 'intro'" shadow="never" class="intro-card">
      <template #header>
        <div class="card-header">
          <el-icon class="header-icon">
            <i-ep-connection />
          </el-icon>
          <div>
            <h3>启用 Git 同步功能</h3>
            <el-text type="info" size="small">版本控制 · 本地编辑 · 多设备同步</el-text>
          </div>
        </div>
      </template>

      <div class="intro-content">
        <div class="features-list">
          <div class="feature-item">
            <el-icon class="feature-icon">
              <i-ep-edit />
            </el-icon>
            <div>
              <h4>本地编辑</h4>
              <p>使用 VS Code 等编辑器编辑账本，享受语法高亮和智能提示</p>
            </div>
          </div>

          <div class="feature-item">
            <el-icon class="feature-icon">
              <i-ep-clock />
            </el-icon>
            <div>
              <h4>版本控制</h4>
              <p>通过 Git 管理账本变更历史，支持历史回溯和变更追踪</p>
            </div>
          </div>

          <div class="feature-item">
            <el-icon class="feature-icon">
              <i-ep-refresh />
            </el-icon>
            <div>
              <h4>多设备同步</h4>
              <p>在不同设备间同步账本数据，随时随地访问和编辑</p>
            </div>
          </div>

          <div class="feature-item">
            <el-icon class="feature-icon">
              <i-ep-cpu />
            </el-icon>
            <div>
              <h4>平台解析</h4>
              <p>继续享受平台的 AI 解析、可视化报表等强大功能</p>
            </div>
          </div>
        </div>

        <el-alert title="注意事项" type="info" :closable="false" show-icon class="notice-alert">
          <ul class="notice-list">
            <li><strong>平台创建</strong>：仅在集成的 Gitea 上新建仓库（模板或空库）</li>
            <li><strong>关联远程</strong>：支持关联任意可公网访问的 SSH 仓库（GitHub / GitLab / Gitea / Gogs /
              自建）；平台会生成用于<strong>拉取</strong>账本的
              Deploy Key（公钥加到远程）并给出 Webhook 配置，本地推送仍使用您自己的 Git 凭据（如需平台「提交到账本」写回，须给该公钥写权限）</li>
            <li>仓库体积建议控制在约 20MB 以内，适合个人账本</li>
          </ul>
        </el-alert>

        <div class="action-buttons">
          <el-button type="primary" size="large" :loading="loading" @click="goPath">
            <el-icon>
              <i-ep-plus />
            </el-icon>
            启用 Git 同步
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 第一层：关联 vs 创建 -->
    <el-card v-else-if="step === 'path'" shadow="never" class="options-card">
      <template #header>
        <div class="card-header">
          <div>
            <h3>关联或创建仓库</h3>
            <el-text type="info" size="small">关联已有远程，或由平台在 Gitea 上新建仓库</el-text>
          </div>
        </div>
      </template>

      <div class="options-content">
        <div class="option-cards path-cards">
          <el-card class="option-card path-card" :body-style="{ padding: '20px' }" shadow="hover" @click="goLinkForm">
            <div class="option-header">
              <el-icon class="option-icon template-icon">
                <i-ep-link />
              </el-icon>
              <div class="option-titles">
                <h4>关联已有远程</h4>
                <el-tag type="warning" size="small">已有 SSH 仓库</el-tag>
              </div>
            </div>
            <p class="path-desc">仓库已在远程平台上：填写 SSH 克隆地址。关联成功后在本页仓库卡片中配置 Webhook，并将平台公钥以只读 Deploy Key 加入远程。</p>
          </el-card>

          <el-card class="option-card path-card" :body-style="{ padding: '20px' }" shadow="hover"
            @click="goHostedTemplates">
            <div class="option-header">
              <el-icon class="option-icon template-icon">
                <i-ep-folder-add />
              </el-icon>
              <div class="option-titles">
                <h4>使用平台创建仓库</h4>
                <el-tag type="success" size="small">Gitea</el-tag>
              </div>
            </div>
            <p class="path-desc">由平台在集成的 Gitea 上创建私有仓库，并选择基于模板或空仓库。</p>
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
            <el-text type="info" size="small">请使用 SSH 克隆地址（git@… 或 ssh://…），支持 GitHub / GitLab / Gitea / Gogs 及自建
              Git</el-text>
          </div>
        </div>
      </template>

      <div class="form-wrap">
        <el-alert type="warning" :closable="false" show-icon title="关联已有账本前，请先完成三处改造" class="ledger-adapt-alert">
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
              留空则由平台从 SSH 地址自动识别；仅在识别不准时手动指定。
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
                <i-ep-document-add />
              </el-icon>
              <div class="option-titles">
                <h4>基于模板创建</h4>
                <el-tag type="success" size="small">推荐新手</el-tag>
              </div>
              <el-radio :model-value="radioModelValue" label="template" @click.stop />
            </div>
            <div class="option-description">
              <p>适合刚开始使用 Beancount 或希望遵循最佳实践的用户</p>
              <ul class="feature-list">
                <li>包含标准目录结构和示例文件</li>
                <li>预配置账户体系和模板</li>
              </ul>
            </div>
          </el-card>

          <el-card :class="['option-card', { selected: selectedOption === false }]" :body-style="{ padding: '20px' }"
            @click="selectOption(false)">
            <div class="option-header">
              <el-icon class="option-icon empty-icon">
                <i-ep-folder />
              </el-icon>
              <div class="option-titles">
                <h4>空仓库创建</h4>
                <el-tag type="info" size="small">推荐迁移用户</el-tag>
              </div>
              <el-radio :model-value="radioModelValue" label="empty" @click.stop />
            </div>
            <div class="option-description">
              <p>适合已有 Beancount 账本需要迁移的用户</p>
              <ul class="feature-list">
                <li>创建空仓库，等待推送现有账本</li>
              </ul>
            </div>
          </el-card>
        </div>

        <el-alert v-if="selectedOption === false" type="warning" :closable="false" show-icon title="关联已有账本前，请先完成三处改造"
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
            <el-icon><i-ep-check /></el-icon>
            创建仓库
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { createGitRepository, linkGitRepository } from '../../api/git'
import type { GitProvider, GitRepository } from '../../types/git'

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
  color: #409EFF;
  font-size: 24px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.intro-content {
  padding: 0 8px;
}

.features-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  background-color: var(--ep-fill-color-lighter);
}

.feature-icon {
  color: #409EFF;
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.feature-item h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
}

.feature-item p {
  margin: 0;
  font-size: 13px;
  color: var(--ep-text-color-regular);
  line-height: 1.5;
}

.notice-alert {
  margin-bottom: 24px;
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

  :deep(.ep-collapse-item__header),
  :deep(.el-collapse-item__header) {
    font-size: 13px;
    color: var(--ep-text-color-secondary);
  }

  :deep(.ep-collapse-item__wrap),
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
  color: var(--ep-text-color-regular);
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
  border-color: var(--ep-border-color-hover);
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
  border-color: var(--ep-border-color-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.option-card.selected {
  border-color: #409EFF;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
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
  color: #67C23A;
}

.empty-icon {
  color: #909399;
}

.option-titles {
  flex: 1;
}

.option-titles h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.option-description p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--ep-text-color-regular);
  line-height: 1.5;
}

.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.feature-list li {
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ep-text-color-regular);
}

@media (max-width: 768px) {
  .features-list {
    grid-template-columns: 1fr;
  }

  .option-cards {
    grid-template-columns: 1fr;
  }

  .action-buttons .el-button {
    width: 100%;
    max-width: 240px;
  }
}
</style>
