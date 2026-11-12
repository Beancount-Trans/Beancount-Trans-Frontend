<template>
    <div class="account-template-container">
        <div class="template-header">
            <h1>官方账户模板</h1>
            <el-button type="info" plain disabled>仅限查看</el-button>
        </div>

        <div v-if="loading" class="empty-state">
            <el-icon class="is-loading" size="32">
                <Loading />
            </el-icon>
            <p>加载中...</p>
        </div>

        <div v-else-if="templates.length === 0" class="empty-state">
            <el-icon size="32">
                <DocumentDelete />
            </el-icon>
            <p>暂无官方模板</p>
        </div>

        <div v-else>
            <el-card v-for="template in templates" :key="template.id" class="template-card">
                <template #header>
                    <div class="template-card__header">
                        <span>{{ template.name }}</span>
                        <div class="header-tags">
                            <el-tag v-if="template.is_official" type="success" class="official-tag">官方</el-tag>
                            <el-tag v-if="template.is_public && !template.is_official" type="primary">公开</el-tag>
                        </div>
                    </div>
                </template>

                <div class="template-meta">
                    <div class="template-meta-item">
                        <span>版本: {{ template.version }}</span>
                    </div>
                    <div class="template-meta-item">
                        <el-icon>
                            <User />
                        </el-icon>
                        <span>创建者: {{ template.owner_name || '系统' }}</span>
                    </div>
                    <div class="template-meta-item">
                        <el-icon>
                            <Clock />
                        </el-icon>
                        <span>更新: {{ formatDate(template.modified) }}</span>
                    </div>
                    <div class="template-meta-item">
                        <el-icon>
                            <List />
                        </el-icon>
                        <span>账户数量: {{ template.items_count }}</span>
                    </div>
                </div>

                <div class="template-description">
                    {{ template.description || '暂无描述' }}
                </div>

                <el-collapse v-if="template.items && template.items.length > 0" v-model="activeNames"
                    class="template-collapse">
                    <el-collapse-item :title="`查看账户列表 (${template.items.length}个)`" :name="template.id">
                        <div class="accounts-list">
                            <div v-for="(group, accountType) in groupedAccounts(template.items)" :key="accountType"
                                class="account-group">
                                <h4 class="account-group-title">
                                    <el-tag :type="getAccountTypeColor(accountType)" size="small">{{ accountType
                                        }}</el-tag>
                                    <span>{{ getAccountTypeName(accountType) }}</span>
                                    <span class="account-count">({{ group.length }})</span>
                                </h4>
                                <div class="account-items">
                                    <div v-for="item in group" :key="item.id" class="account-item">
                                        <div class="account-item-left">
                                            <el-tooltip v-if="item.description" :content="item.description"
                                                placement="top">
                                                <span class="account-path">{{ item.account_path }}</span>
                                            </el-tooltip>
                                            <span v-else class="account-path">{{ item.account_path }}</span>
                                            <span v-if="item.reconciliation_rule" class="reconciliation-cycle">
                                                <el-icon>
                                                    <Clock />
                                                </el-icon>
                                                <span>{{ item.reconciliation_rule }}</span>
                                            </span>
                                        </div>
                                        <div class="account-item-right">
                                            <el-tag :type="item.enable ? 'success' : 'info'" size="small">
                                                {{ item.enable ? '启用' : '禁用' }}
                                            </el-tag>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </el-collapse-item>
                </el-collapse>

                <div v-if="template.update_notes" style="margin-top: 15px;">
                    <el-text type="info" size="small">更新说明: {{ template.update_notes }}</el-text>
                </div>

                <div class="template-actions">
                    <el-button type="primary" @click="showApplyDialog(template)">
                        <el-icon>
                            <Download />
                        </el-icon>
                        应用模板
                    </el-button>
                </div>
            </el-card>
        </div>

        <!-- 应用模板对话框 -->
        <el-dialog v-model="applyDialogVisible" title="应用账户模板" width="500px">
            <div v-if="selectedTemplate">
                <el-alert title="注意" type="warning" :closable="false" show-icon style="margin-bottom: 20px;">
                    <p>应用模板将会影响您的账户结构，请谨慎选择应用策略</p>
                    <p>覆盖操作会导致现有映射无法匹配到账户，请及时更新映射规则</p>
                </el-alert>

                <el-form :model="applyForm" label-width="120px">
                    <el-form-item label="模板名称">
                        <el-text>{{ selectedTemplate.name }}</el-text>
                    </el-form-item>
                    <el-form-item label="账户数量">
                        <el-text>{{ selectedTemplate.items_count }} 个</el-text>
                    </el-form-item>
                    <el-form-item label="应用策略">
                        <el-radio-group v-model="applyForm.action">
                            <el-radio label="merge">合并模式</el-radio>
                            <el-radio label="overwrite">覆盖模式</el-radio>
                        </el-radio-group>
                        <div class="strategy-description">
                            <el-text v-if="applyForm.action === 'merge'" size="small" type="info">
                                保留现有账户，只添加不存在的账户
                            </el-text>
                            <el-text v-else size="small" type="warning">
                                清空现有账户，完全替换为模板账户
                            </el-text>
                        </div>
                    </el-form-item>
                    <el-form-item v-if="applyForm.action === 'merge'" label="冲突处理">
                        <el-radio-group v-model="applyForm.conflict_resolution">
                            <el-radio label="skip">跳过</el-radio>
                            <el-radio label="overwrite">覆盖</el-radio>
                        </el-radio-group>
                        <div class="strategy-description">
                            <el-text size="small" type="info">
                                当账户已存在时：跳过保留现有账户，覆盖替换为模板账户
                            </el-text>
                        </div>
                    </el-form-item>
                </el-form>
            </div>

            <template #footer>
                <el-button @click="applyDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="confirmApply" :loading="applyLoading">
                    确定应用
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Clock, DocumentDelete, Loading, Download, List } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import { getAccountTypeColor } from '~/utils/accountTypeColor'

interface AccountTemplateItem {
    id: number
    account_path: string
    enable: boolean
    reconciliation_rule?: string | null
    description?: string
}

interface AccountTemplate {
    id: number
    name: string
    description?: string
    is_public: boolean
    is_official: boolean
    version: string
    update_notes?: string
    owner_name?: string
    modified: string
    items_count: number
    items?: AccountTemplateItem[]
}

// 响应式数据
const templates = ref<AccountTemplate[]>([])
const loading = ref(false)
const activeNames = ref<number[]>([]) // 默认不展开
const applyDialogVisible = ref(false)
const selectedTemplate = ref<AccountTemplate | null>(null)
const applyLoading = ref(false)

const applyForm = ref({
    action: 'merge',
    conflict_resolution: 'skip'
})

// 获取账户类型名称
const getAccountTypeName = (type: string) => {
    const nameMap: Record<string, string> = {
        'Assets': '资产账户',
        'Liabilities': '负债账户',
        'Equity': '权益账户',
        'Income': '收入账户',
        'Expenses': '支出账户'
    }
    return nameMap[type] || type
}

// 按账户类型分组
const groupedAccounts = (items: AccountTemplateItem[]) => {
    const groups: Record<string, AccountTemplateItem[]> = {}

    items.forEach(item => {
        const accountType = item.account_path.split(':')[0]
        if (!groups[accountType]) {
            groups[accountType] = []
        }
        groups[accountType].push(item)
    })

    // 按特定顺序返回
    const order = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses']
    const sorted: Record<string, AccountTemplateItem[]> = {}
    order.forEach(type => {
        if (groups[type]) {
            sorted[type] = groups[type]
        }
    })

    return sorted
}

// 格式化日期
const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 获取模板数据
const fetchTemplates = async () => {
    loading.value = true
    try {
        const response = await axios.get('/account-templates/', {
            params: {
                is_official: true
            }
        })
        templates.value = response.data

        // 为每个模板获取详细条目信息
        for (let template of templates.value) {
            try {
                const detailResponse = await axios.get(`/account-templates/${template.id}/`)
                template.items = detailResponse.data.items || []
            } catch (error) {
                console.error(`获取模板 ${template.name} 的详情失败:`, error)
                template.items = []
            }
        }
    } catch (error) {
        console.error('获取模板列表失败:', error)
        ElMessage.error('获取模板数据失败')
    } finally {
        loading.value = false
    }
}

// 显示应用对话框
const showApplyDialog = (template: AccountTemplate) => {
    selectedTemplate.value = template
    applyForm.value = {
        action: 'merge',
        conflict_resolution: 'skip'
    }
    applyDialogVisible.value = true
}

// 确认应用模板
const confirmApply = async () => {
    if (!selectedTemplate.value) return

    try {
        applyLoading.value = true

        const response = await axios.post(`/account-templates/${selectedTemplate.value.id}/apply/`, {
            action: applyForm.value.action,
            conflict_resolution: applyForm.value.conflict_resolution
        })

        const result = response.data.result
        ElMessage.success({
            message: `模板应用成功！创建: ${result.created}, 跳过: ${result.skipped}, 覆盖: ${result.overwritten}`,
            duration: 5000
        })

        applyDialogVisible.value = false
    } catch (error: any) {
        console.error('应用模板失败:', error)
        if (error.response?.status === 401) {
            ElMessage.error('未登录，请先登录')
        } else {
            ElMessage.error(error.response?.data?.error || '应用模板失败')
        }
    } finally {
        applyLoading.value = false
    }
}

// 组件挂载时获取数据
onMounted(() => {
    fetchTemplates()
})
</script>

<style scoped>
.account-template-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
    background-color: var(--el-bg-color);
    border-radius: 12px;
}

.template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.template-header h1 {
    margin: 0;
    font-size: 24px;
    color: var(--el-text-color-primary);
}

.template-card {
    margin-bottom: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    background-color: var(--el-fill-color-light);
}

.template-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-tags {
    display: flex;
    gap: 8px;
}

.template-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 10px;
    color: var(--el-text-color-regular);
    font-size: 14px;
    gap: 15px;
}

.template-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.template-description {
    margin: 10px 0;
    color: var(--el-text-color-regular);
}

.template-collapse {
    margin-top: 15px;
}

.accounts-list {
    max-height: 400px;
    overflow-y: auto;
}

.account-group {
    margin-bottom: 20px;
}

.account-group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px 0;
    font-size: 14px;
    color: var(--el-text-color-primary);
}

.account-count {
    color: var(--el-text-color-secondary);
    font-weight: normal;
}

.account-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.account-item {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;
    border-left: 3px solid var(--el-color-primary);
}

.account-item-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    align-items: flex-start;
}

.account-item-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.account-path {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    color: var(--el-text-color-regular);
}

.reconciliation-cycle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.template-actions {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--el-border-color);
    display: flex;
    justify-content: flex-end;
}

.official-tag {
    margin-left: 10px;
}

.empty-state {
    text-align: center;
    padding: 40px 0;
    color: var(--el-text-color-secondary);
}

.empty-state .el-icon {
    margin-bottom: 10px;
}

.strategy-description {
    margin-top: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .account-template-container {
        padding: 12px;
    }

    .template-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }

    .template-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }
}
</style>
