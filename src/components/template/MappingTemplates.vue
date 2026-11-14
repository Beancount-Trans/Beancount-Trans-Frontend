<template>
    <div class="template-container">
        <div class="template-header">
            <h1>官方映射模板</h1>
            <el-button type="info" plain disabled>仅限查看</el-button>
        </div>

        <el-tabs v-model="activeType">
            <el-tab-pane label="支出模板" name="expense"></el-tab-pane>
            <el-tab-pane label="收入模板" name="income"></el-tab-pane>
            <el-tab-pane label="资产模板" name="assets"></el-tab-pane>
        </el-tabs>

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
                        <el-tag v-if="template.is_official" type="success" class="official-tag">官方</el-tag>
                    </div>
                </template>

                <div class="template-meta">
                    <div class="template-meta-item">
                        <el-tag :type="getTypeTag(template.type)" class="template-type-tag">
                            {{ getTypeText(template.type) }}
                        </el-tag>
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
                </div>

                <div class="template-description">
                    {{ template.description || '暂无描述' }}
                </div>

                <el-collapse v-if="template.items && template.items.length > 0" v-model="activeNames">
                    <el-collapse-item title="查看映射条目" name="1">
                        <el-table :data="template.items" class="items-table" stripe>
                            <el-table-column label="关键字" prop="key"></el-table-column>

                            <!-- 支出模板特有字段 -->
                            <el-table-column v-if="template.type === 'expense'" label="对方"
                                prop="payee"></el-table-column>
                            <el-table-column v-if="template.type === 'expense'" label="支出账户">
                                <template #default="{ row }">
                                    {{ row.account || '-' }}
                                </template>
                            </el-table-column>
                            <el-table-column v-if="template.type === 'expense'" label="货币" width="80">
                                <template #default="{ row }">
                                    <span>{{ row.currency || 'CNY' }}</span>
                                </template>
                            </el-table-column>

                            <!-- 收入模板特有字段 -->
                            <!-- <el-table-column v-if="template.type === 'income'" label="付款方" prop="payer"></el-table-column> -->
                            <el-table-column v-if="template.type === 'income'" label="收入账户">
                                <template #default="{ row }">
                                    {{ row.account || '-' }}
                                </template>
                            </el-table-column>

                            <!-- 资产模板特有字段 -->
                            <el-table-column v-if="template.type === 'assets'" label="资产账户">
                                <template #default="{ row }">
                                    {{ row.account || '-' }}
                                </template>
                            </el-table-column>
                        </el-table>
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
        <el-dialog v-model="applyDialogVisible" title="应用映射模板" width="500px">
            <div v-if="selectedTemplate">
                <el-alert title="注意" type="warning" :closable="false" show-icon style="margin-bottom: 20px;">
                    <p>应用模板将会影响您的映射规则，请谨慎选择应用策略。</p>
                </el-alert>

                <el-form :model="applyForm" label-width="120px">
                    <el-form-item label="模板名称">
                        <el-text>{{ selectedTemplate.name }}</el-text>
                    </el-form-item>
                    <el-form-item label="模板类型">
                        <el-tag :type="getTypeTag(selectedTemplate.type)">
                            {{ getTypeText(selectedTemplate.type) }}
                        </el-tag>
                    </el-form-item>
                    <el-form-item label="映射数量">
                        <el-text>{{ selectedTemplate.items?.length || 0 }} 个</el-text>
                    </el-form-item>
                    <el-form-item label="应用策略">
                        <el-radio-group v-model="applyForm.action">
                            <el-radio label="merge">合并模式</el-radio>
                            <el-radio label="overwrite">覆盖模式</el-radio>
                        </el-radio-group>
                        <div class="strategy-description">
                            <el-text v-if="applyForm.action === 'merge'" size="small" type="info">
                                保留现有映射，只添加不存在的映射
                            </el-text>
                            <el-text v-else size="small" type="warning">
                                清空现有{{ getTypeText(selectedTemplate.type) }}映射，完全替换为模板映射
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
                                当映射关键字已存在时：跳过保留现有映射，覆盖替换为模板映射
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
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Clock, DocumentDelete, Loading, Download } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import type { TagProps } from 'element-plus'

interface TemplateItemDetail {
    id: number;
    key: string;
    account: string | null; // 账户路径字符串，可能为 null
    payee?: string | null;
    payer?: string | null;
    currency?: string | null;
    created?: string;
    modified?: string;
}

interface MissingAccount {
    key: string;
    account: string;
}

interface TemplateApplyResult {
    created: number;
    skipped: number;
    overwritten: number;
    missing_accounts?: MissingAccount[];
}

interface TemplateItem {
    id: number;
    name: string;
    is_official: boolean;
    type: string;
    version: string;
    owner_name?: string;
    modified: string;
    description?: string;
    update_notes?: string;
    items?: TemplateItemDetail[];
}

// 响应式数据
const activeType = ref('expense')
const templates = ref<TemplateItem[]>([])
const loading = ref(false)
const activeNames = ref<string[]>([])
const applyDialogVisible = ref(false)
const selectedTemplate = ref<TemplateItem | null>(null)
const applyLoading = ref(false)

const applyForm = ref({
    action: 'merge',
    conflict_resolution: 'skip'
})

// 获取模板类型文本
const getTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
        'expense': '支出',
        'income': '收入',
        'assets': '资产'
    }
    return typeMap[type] || type
}

// 获取模板类型标签样式
const getTypeTag = (type: string): TagProps['type'] => {
    const typeTagMap: Record<string, TagProps['type']> = {
        // 'expense': 'danger',
        // 'income': 'success',
        // 'assets': 'warning'
        'expense': 'warning',
        'income': 'primary',
        'assets': 'success'
    }
    return typeTagMap[type] || 'info'
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
        const response = await axios.get('/templates/', {
            params: {
                type: activeType.value,
                is_official: true
            }
        })
        templates.value = response.data

        // 为每个模板获取详细条目信息
        for (let template of templates.value) {
            try {
                const detailResponse = await axios.get(`/templates/${template.id}/`)
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
const showApplyDialog = (template: TemplateItem) => {
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

        const response = await axios.post(`/templates/${selectedTemplate.value.id}/apply/`, {
            action: applyForm.value.action,
            conflict_resolution: applyForm.value.conflict_resolution
        })

        const result: TemplateApplyResult = response.data.result
        const missingAccounts: MissingAccount[] = result.missing_accounts || []

        // 构建成功消息
        let successMessage = `${getTypeText(selectedTemplate.value.type)}模板应用成功！创建: ${result.created}, 跳过: ${result.skipped}, 覆盖: ${result.overwritten}`

        if (missingAccounts.length > 0) {
            successMessage += `。注意：有 ${missingAccounts.length} 个映射的账户不存在，已设置为空，请及时处理。`
        }

        ElMessage.success({
            message: successMessage,
            duration: missingAccounts.length > 0 ? 7000 : 5000
        })

        applyDialogVisible.value = false
    } catch (error: unknown) {
        console.error('应用模板失败:', error)

        // 类型安全的错误处理
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number; data?: { error?: string; message?: string } } }
            const status = axiosError.response?.status
            const errorMessage = axiosError.response?.data?.error || axiosError.response?.data?.message

            if (status === 401) {
                ElMessage.error('未登录，请先登录')
            } else {
                ElMessage.error(errorMessage || '应用模板失败')
            }
        } else {
            ElMessage.error('网络错误，请稍后重试')
        }
    } finally {
        applyLoading.value = false
    }
}

// 监听标签页变化
watch(activeType, () => {
    fetchTemplates()
}, { immediate: true })
</script>

<style scoped>
.template-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.template-card {
    margin-bottom: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.template-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.template-meta {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    color: var(--text-secondary);
    font-size: 14px;
}

.template-meta-item {
    margin-right: 15px;
    display: flex;
    align-items: center;
}

.template-description {
    margin: 10px 0;
    color: var(--text-secondary);
}

.items-table {
    margin-top: 15px;
}

.official-tag {
    margin-left: 10px;
}

.template-type-tag {
    margin-right: 10px;
}

.empty-state {
    text-align: center;
    padding: 40px 0;
    color: var(--text-secondary);
}

.collapse-content {
    padding: 0;
}

.template-actions {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--el-border-color-lighter);
    display: flex;
    justify-content: flex-end;
}

.strategy-description {
    margin-top: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .template-container {
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
