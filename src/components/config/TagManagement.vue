<template>
    <div class="tag-management">
        <div class="management-header">
            <h2>标签管理</h2>
            <div class="header-actions">
                <el-button type="primary" @click="showAddDialog">
                    <el-icon>
                        <Plus />
                    </el-icon>
                    新增标签
                </el-button>
            </div>
        </div>

        <div class="management-content">
            <!-- 左侧：标签树 -->
            <div class="tag-tree-panel">
                <el-tree :data="filteredTagTree" :props="treeProps" node-key="id" :expand-on-click-node="false"
                    :default-expand-all="false" :default-expanded-keys="defaultExpandedKeys"
                    @node-click="handleNodeClick" @node-expand="handleNodeExpand" @node-collapse="handleNodeCollapse"
                    class="tag-tree" v-loading="loading">
                    <template #default="{ node, data }">
                        <div class="tree-node">
                            <span class="node-label">{{ data.name }}</span>
                            <div class="node-actions">
                                <el-tag v-if="data.mapping_count && data.mapping_count.total > 0" size="small"
                                    type="info">
                                    {{ data.mapping_count.total }}映射
                                </el-tag>
                                <el-switch v-model="data.enable" size="small" @change="updateTagStatus(data)"
                                    style="margin-left: 8px;" />
                            </div>
                        </div>
                    </template>
                </el-tree>
            </div>

            <!-- 右侧：标签详情 -->
            <div class="tag-detail-panel">
                <div v-if="selectedTag" class="tag-detail">
                    <h3>{{ selectedTag.full_path }}</h3>

                    <!-- 基本信息 -->
                    <el-card class="info-card">
                        <template #header>
                            <span>基本信息</span>
                        </template>
                        <el-descriptions :column="2" border>
                            <el-descriptions-item label="标签名称">
                                <code>{{ selectedTag.full_path }}</code>
                            </el-descriptions-item>
                            <el-descriptions-item label="启用状态">
                                <el-switch v-model="selectedTag.enable" @change="updateTagStatus(selectedTag)" />
                            </el-descriptions-item>
                            <el-descriptions-item label="映射统计" v-if="selectedTag.mapping_count">
                                <div class="mapping-stats">
                                    <el-tooltip v-if="selectedTag.mapping_count.expense > 0"
                                        :content="getExpenseMappingTooltip()" placement="top" effect="dark">
                                        <el-tag type="warning" style="cursor: default;">
                                            {{ selectedTag.mapping_count.expense }}支出
                                        </el-tag>
                                    </el-tooltip>
                                    <el-tooltip v-if="selectedTag.mapping_count.assets > 0"
                                        :content="getAssetsMappingTooltip()" placement="top" effect="dark">
                                        <el-tag type="success" style="cursor: default;">
                                            {{ selectedTag.mapping_count.assets }}资产
                                        </el-tag>
                                    </el-tooltip>
                                    <el-tooltip v-if="selectedTag.mapping_count.income > 0"
                                        :content="getIncomeMappingTooltip()" placement="top" effect="dark">
                                        <el-tag type="primary" style="cursor: default;">
                                            {{ selectedTag.mapping_count.income }}收入
                                        </el-tag>
                                    </el-tooltip>
                                    <el-tag type="info" size="small">{{ selectedTag.mapping_count.total }}总计</el-tag>
                                    <el-button v-if="selectedTag.mapping_count.total > 0" size="small" type="text"
                                        @click="toggleMappingDetails" style="margin-left: 8px;">
                                        {{ showMappingDetails ? '收起详情' : '查看详情' }}
                                    </el-button>
                                </div>
                            </el-descriptions-item>
                            <el-descriptions-item label="描述">
                                {{ selectedTag.description || '暂无描述' }}
                            </el-descriptions-item>
                        </el-descriptions>
                    </el-card>

                    <!-- 映射详情 -->
                    <el-card
                        v-if="showMappingDetails && selectedTag.mapping_count && selectedTag.mapping_count.total > 0"
                        class="mapping-details-card">
                        <template #header>
                            <span>映射详情</span>
                        </template>
                        <div class="mapping-details-content" v-loading="mappingDetailsLoading">
                            <el-tabs v-model="activeMappingTab" type="card">
                                <!-- 支出映射 -->
                                <el-tab-pane label="支出映射" name="expense"
                                    v-if="tagMappings.expense_mappings && tagMappings.expense_mappings.length > 0">
                                    <div class="mapping-list">
                                        <div v-for="mapping in tagMappings.expense_mappings" :key="mapping.id"
                                            class="mapping-item">
                                            <div class="mapping-info">
                                                <span class="mapping-key">{{ mapping.key }}</span>
                                                <span v-if="mapping.payee" class="mapping-payee">{{ mapping.payee
                                                }}</span>
                                                <span class="mapping-account">→ {{ mapping.account || '未知账户' }}</span>
                                                <span v-if="mapping.currency" class="mapping-currency">{{
                                                    mapping.currency }}</span>
                                            </div>
                                            <el-tag :type="mapping.enable ? 'success' : 'info'" size="small">
                                                {{ mapping.enable ? '启用' : '禁用' }}
                                            </el-tag>
                                        </div>
                                    </div>
                                </el-tab-pane>

                                <!-- 资产映射 -->
                                <el-tab-pane label="资产映射" name="assets"
                                    v-if="tagMappings.assets_mappings && tagMappings.assets_mappings.length > 0">
                                    <div class="mapping-list">
                                        <div v-for="mapping in tagMappings.assets_mappings" :key="mapping.id"
                                            class="mapping-item">
                                            <div class="mapping-info">
                                                <span class="mapping-key">{{ mapping.key }}</span>
                                                <span class="mapping-account">→ {{ mapping.account || '未知账户' }}</span>
                                            </div>
                                            <el-tag :type="mapping.enable ? 'success' : 'info'" size="small">
                                                {{ mapping.enable ? '启用' : '禁用' }}
                                            </el-tag>
                                        </div>
                                    </div>
                                </el-tab-pane>

                                <!-- 收入映射 -->
                                <el-tab-pane label="收入映射" name="income"
                                    v-if="tagMappings.income_mappings && tagMappings.income_mappings.length > 0">
                                    <div class="mapping-list">
                                        <div v-for="mapping in tagMappings.income_mappings" :key="mapping.id"
                                            class="mapping-item">
                                            <div class="mapping-info">
                                                <span class="mapping-key">{{ mapping.key }}</span>
                                                <span v-if="mapping.payer" class="mapping-payer">{{ mapping.payer
                                                }}</span>
                                                <span class="mapping-account">→ {{ mapping.account || '未知账户' }}</span>
                                            </div>
                                            <el-tag :type="mapping.enable ? 'success' : 'info'" size="small">
                                                {{ mapping.enable ? '启用' : '禁用' }}
                                            </el-tag>
                                        </div>
                                    </div>
                                </el-tab-pane>
                            </el-tabs>
                        </div>
                    </el-card>

                    <!-- 操作按钮 -->
                    <div class="detail-actions">
                        <el-button type="primary" @click="showEditDialog(selectedTag)">
                            <el-icon>
                                <Edit />
                            </el-icon>
                            编辑
                        </el-button>
                        <el-button type="danger" @click="handleDelete(selectedTag)">
                            <el-icon>
                                <Delete />
                            </el-icon>
                            删除
                        </el-button>
                    </div>
                </div>

                <el-empty v-else description="请选择标签查看详情" />
            </div>
        </div>

        <!-- 新增/编辑标签对话框 -->
        <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" @close="resetForm">
            <el-form :model="tagForm" :rules="formRules" ref="formRef" label-width="100px">
                <el-form-item label="标签名称" prop="name">
                    <el-input v-model="tagForm.name" placeholder="例如：Project/Decoration 或 Irregular" />
                    <div class="form-help-text">
                        支持层级格式：使用斜杠分隔，如 Project/Decoration 将自动创建父标签 Project
                    </div>
                </el-form-item>
                <el-form-item label="描述" prop="description">
                    <el-input v-model="tagForm.description" type="textarea" :rows="3" placeholder="请输入标签描述（可选）" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import {
    fetchTagTree,
    createTag,
    updateTag,
    deleteTag,
    updateTagEnable,
    fetchTagMappings
} from '../../api/tags'
import type { Tag, TagForm } from '../../types/tag'
import { extractApiErrorMessage } from '../../utils/errorHelper'

// 响应式数据
const tagTree = ref<Tag[]>([])
const selectedTag = ref<Tag | null>(null)
const loading = ref(false)
const searchKeyword = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('新增标签')
const submitting = ref(false)
const formRef = ref<FormInstance>()
const defaultExpandedKeys = ref<number[]>([])

// 映射详情相关
const showMappingDetails = ref(false)
const mappingDetailsLoading = ref(false)
const tagMappings = ref<any>({
    expense_mappings: [],
    assets_mappings: [],
    income_mappings: []
})
const activeMappingTab = ref('expense')

// 树形配置
const treeProps = {
    label: 'name',
    children: 'children'
}

// 表单数据
const tagForm = ref<TagForm>({
    name: '',
    description: ''
})

// 表单验证规则
const formRules: FormRules = {
    name: [
        { required: true, message: '请输入标签名称', trigger: 'blur' },
        { min: 1, max: 64, message: '标签名称长度在 1 到 64 个字符', trigger: 'blur' },
        {
            pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_/-]+$/,
            message: '标签名称只能包含字母、数字、中文、下划线、横线和斜杠',
            trigger: 'blur'
        }
    ]
}

// 过滤后的标签树（用于搜索）
const filteredTagTree = computed(() => {
    if (!searchKeyword.value) {
        return tagTree.value
    }
    return filterTree(tagTree.value, searchKeyword.value.toLowerCase())
})

// 过滤树节点
const filterTree = (nodes: Tag[], keyword: string): Tag[] => {
    const result: Tag[] = []
    for (const node of nodes) {
        const matches = node.name.toLowerCase().includes(keyword) ||
            node.full_path.toLowerCase().includes(keyword) ||
            (node.description && node.description.toLowerCase().includes(keyword))

        if (matches) {
            result.push(node)
        } else if (node.children && node.children.length > 0) {
            const filteredChildren = filterTree(node.children, keyword)
            if (filteredChildren.length > 0) {
                result.push({
                    ...node,
                    children: filteredChildren
                })
            }
        }
    }
    return result
}

// 加载标签树
const loadTagTree = async () => {
    try {
        loading.value = true
        const response = await fetchTagTree()
        tagTree.value = response.data || []
        console.log('标签树加载完成:', tagTree.value)
    } catch (error: any) {
        console.error('加载标签树失败:', error)
        ElMessage.error('加载标签树失败')
    } finally {
        loading.value = false
    }
}

// 搜索处理
const handleSearch = () => {
    // 搜索时自动展开所有匹配的节点
    if (searchKeyword.value) {
        const expandKeys: number[] = []
        const collectKeys = (nodes: Tag[]) => {
            nodes.forEach(node => {
                expandKeys.push(node.id)
                if (node.children) {
                    collectKeys(node.children)
                }
            })
        }
        collectKeys(filteredTagTree.value)
        defaultExpandedKeys.value = expandKeys
    }
}

// 点击节点
const handleNodeClick = async (tag: Tag) => {
    selectedTag.value = tag
    console.log('选中标签:', tag)
    // 重置映射详情状态
    showMappingDetails.value = false

    // 自动获取映射数据
    await fetchMappings()
}

// 节点展开
const handleNodeExpand = (data: Tag) => {
    if (!defaultExpandedKeys.value.includes(data.id)) {
        defaultExpandedKeys.value.push(data.id)
    }
}

// 节点折叠
const handleNodeCollapse = (data: Tag) => {
    const index = defaultExpandedKeys.value.indexOf(data.id)
    if (index > -1) {
        defaultExpandedKeys.value.splice(index, 1)
    }
}

// 显示新增对话框
const showAddDialog = () => {
    dialogTitle.value = '新增标签'
    resetForm()
    dialogVisible.value = true
}

// 显示编辑对话框
const showEditDialog = (tag: Tag) => {
    dialogTitle.value = '编辑标签'
    tagForm.value = {
        name: tag.full_path,  // 使用完整路径
        description: tag.description
    }
    dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
    tagForm.value = {
        name: '',
        description: ''
    }
    formRef.value?.clearValidate()
}

// 提交表单
const handleSubmit = async () => {
    if (!formRef.value) return

    try {
        await formRef.value.validate()
        submitting.value = true

        if (dialogTitle.value === '新增标签') {
            await createTag(tagForm.value)
            ElMessage.success('标签创建成功')
        } else {
            if (selectedTag.value) {
                await updateTag(selectedTag.value.id, tagForm.value)
                ElMessage.success('标签更新成功')
            }
        }

        dialogVisible.value = false
        await loadTagTree()

        // 如果是编辑，重新选中该标签
        if (selectedTag.value) {
            const updatedTag = findTagById(tagTree.value, selectedTag.value.id)
            if (updatedTag) {
                selectedTag.value = updatedTag
            }
        }
    } catch (error: any) {
        console.error('提交失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else if (error.response?.status === 400) {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '操作失败，请检查标签名称'))
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '操作失败'))
        }
    } finally {
        submitting.value = false
    }
}

// 更新标签状态
const updateTagStatus = async (tag: Tag) => {
    try {
        await updateTagEnable(tag.id, tag.enable)
        ElMessage.success(`标签已${tag.enable ? '启用' : '禁用'}`)
        await loadTagTree()
    } catch (error) {
        console.error('更新标签状态失败:', error)
        ElMessage.error('更新状态失败')
        // 恢复状态
        tag.enable = !tag.enable
    }
}

// 删除标签
const handleDelete = async (tag: Tag) => {
    try {
        const hasChildren = tag.has_children
        const confirmMsg = hasChildren
            ? `标签 "${tag.full_path}" 包含子标签，是否强制删除（包括所有子标签）？`
            : `确定要删除标签 "${tag.full_path}" 吗？`

        await ElMessageBox.confirm(confirmMsg, '删除确认', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        })

        await deleteTag(tag.id, { force: hasChildren })
        ElMessage.success('标签删除成功')
        selectedTag.value = null
        await loadTagTree()
    } catch (error: any) {
        if (error !== 'cancel') {
            console.error('删除标签失败:', error)
            if (error.response?.data?.error) {
                ElMessage.error(error.response.data.error)
            } else {
                ElMessage.error('删除标签失败')
            }
        }
    }
}

// 根据ID查找标签
const findTagById = (tags: Tag[], id: number): Tag | null => {
    for (const tag of tags) {
        if (tag.id === id) return tag
        if (tag.children) {
            const found = findTagById(tag.children, id)
            if (found) return found
        }
    }
    return null
}

// 格式化日期时间
const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// 切换映射详情显示
const toggleMappingDetails = () => {
    showMappingDetails.value = !showMappingDetails.value
}

// 获取标签映射详情
const fetchMappings = async () => {
    if (!selectedTag.value) return

    try {
        mappingDetailsLoading.value = true
        const response = await fetchTagMappings(selectedTag.value.id)
        tagMappings.value = response.data

        // 设置默认激活的标签页
        if (response.data.expense_mappings && response.data.expense_mappings.length > 0) {
            activeMappingTab.value = 'expense'
        } else if (response.data.assets_mappings && response.data.assets_mappings.length > 0) {
            activeMappingTab.value = 'assets'
        } else if (response.data.income_mappings && response.data.income_mappings.length > 0) {
            activeMappingTab.value = 'income'
        }
    } catch (error: any) {
        console.error('获取映射详情失败:', error)
        ElMessage.error('获取映射详情失败')
    } finally {
        mappingDetailsLoading.value = false
    }
}

// 获取支出映射悬浮提示内容
const getExpenseMappingTooltip = () => {
    if (!tagMappings.value.expense_mappings || tagMappings.value.expense_mappings.length === 0) {
        return '暂无支出映射'
    }
    return tagMappings.value.expense_mappings
        .map((m: any) => `${m.key} → ${m.account || '未知账户'}`)
        .join('\n')
}

// 获取资产映射悬浮提示内容
const getAssetsMappingTooltip = () => {
    if (!tagMappings.value.assets_mappings || tagMappings.value.assets_mappings.length === 0) {
        return '暂无资产映射'
    }
    return tagMappings.value.assets_mappings
        .map((m: any) => `${m.key} → ${m.account || '未知账户'}`)
        .join('\n')
}

// 获取收入映射悬浮提示内容
const getIncomeMappingTooltip = () => {
    if (!tagMappings.value.income_mappings || tagMappings.value.income_mappings.length === 0) {
        return '暂无收入映射'
    }
    return tagMappings.value.income_mappings
        .map((m: any) => `${m.key} → ${m.account || '未知账户'}`)
        .join('\n')
}

// 组件挂载
onMounted(() => {
    loadTagTree()
})
</script>

<style scoped>
.tag-management {
    padding: 20px;
    background-color: var(--el-bg-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    animation: fadeIn 0.6s ease;
}

.management-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--el-border-color);
}

.management-header h2 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 24px;
    font-weight: 600;
}

.header-actions {
    display: flex;
    gap: 12px;
}

.management-content {
    display: flex;
    gap: 20px;
    min-height: 600px;
}

.tag-tree-panel {
    flex: 0 0 400px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    padding: 15px;
    background-color: var(--el-fill-color-light);
}

.tag-detail-panel {
    flex: 1;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    padding: 20px;
    background-color: var(--el-bg-color);
}

.tag-tree {
    background-color: transparent;
}

/* 树节点左对齐 */
:deep(.el-tree-node__content) {
    justify-content: flex-start;
}

.tree-node {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 4px 0;
}

.node-label {
    font-weight: 500;
    color: var(--el-text-color-primary);
}

.node-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tag-detail h3 {
    margin: 0 0 20px 0;
    color: var(--el-text-color-primary);
    font-size: 20px;
    font-weight: 600;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--el-color-primary);
}

.info-card {
    margin-bottom: 20px;
}

/* 固定 el-descriptions 列宽 */
.info-card :deep(.el-descriptions__label) {
    width: 100px;
    min-width: 100px;
    max-width: 100px;
}

.info-card :deep(.el-descriptions__content) {
    width: auto;
    word-break: break-word;
}

.info-card code {
    background: var(--el-fill-color-light);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    word-break: break-all;
    display: inline-block;
    max-width: 100%;
}

.detail-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--el-border-color);
}

.form-help-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
}

.mapping-stats {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}

/* 映射详情样式 */
.mapping-details-card {
    margin-bottom: 20px;
}

.mapping-details-content {
    min-height: 200px;
}

.mapping-list {
    max-height: 300px;
    overflow-y: auto;
}

.mapping-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    margin-bottom: 8px;
    background-color: var(--el-fill-color-light);
    border-radius: 6px;
    border: 1px solid var(--el-border-color);
    transition: all 0.2s ease;
}

.mapping-item:hover {
    background-color: var(--el-fill-color);
    border-color: var(--el-border-color);
}

.mapping-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
}

.mapping-key {
    font-weight: 500;
    color: var(--el-text-color-primary);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background-color: var(--el-fill-color-lighter);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
}

.mapping-payee,
.mapping-full,
.mapping-payer {
    color: var(--el-text-color-regular);
    font-size: 14px;
}

.mapping-account {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background-color: var(--el-color-primary-light-9);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--el-color-primary);
}

.mapping-currency {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-style: italic;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* 响应式设计 */
@media (max-width: 768px) {
    .management-content {
        flex-direction: column;
    }

    .tag-tree-panel {
        flex: none;
    }

    .management-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }

    .header-actions {
        width: 100%;
        justify-content: flex-end;
    }
}
</style>
