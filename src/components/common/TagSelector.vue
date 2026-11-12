<template>
    <div class="tag-selector">
        <!-- 多选模式：使用下拉多选框 -->
        <el-select v-if="multiple" v-model="selectedValues" multiple filterable :placeholder="placeholder"
            @change="handleChange" @visible-change="handleVisibleChange" style="width: 100%;" :disabled="disabled"
            v-loading="loading">
            <template #tag>
                <el-tag v-for="tagId in selectedValues" :key="tagId" closable size="small"
                    :type="isTagClosed(tagId) ? 'info' : undefined" @close="removeTag(tagId)">
                    {{ getTagFullPath(tagId) }}
                </el-tag>
            </template>
            <el-option v-for="tag in enabledFlatTags" :key="tag.id" :label="tag.full_path" :value="tag.id">
                <div class="tag-option" :class="{ 'tag-option-closed': !tag.enable }">
                    <span class="tag-label">{{ tag.full_path }}</span>
                    <el-tag v-if="tag.description" size="small" type="info" class="tag-desc">
                        {{ tag.description }}
                    </el-tag>
                    <el-tag v-if="tag.has_children" size="small" type="warning" class="children-tag">
                        {{ tag.children?.length || 0 }}子标签
                    </el-tag>
                </div>
            </el-option>
        </el-select>

        <!-- 单选模式：使用级联选择器 -->
        <el-cascader v-else v-model="cascaderValue" :options="cascaderOptions" :props="cascaderProps" :filterable="true"
            :filter-method="customFilterMethod" :clearable="true" :show-all-levels="false" :separator="' > '"
            :placeholder="placeholder" @change="handleChange" @visible-change="handleVisibleChange" style="width: 100%;"
            :disabled="disabled" class="tag-cascader">
            <template #default="{ node, data }">
                <div class="cascader-node" :class="{ 'tag-option-closed': data.enable === false }">
                    <span class="node-label">{{ data.name }}</span>
                    <el-tag v-if="data.description" size="small" type="info" class="desc-tag">
                        {{ data.description }}
                    </el-tag>
                    <el-tag v-if="data.has_children && data.children && data.children.length > 0" size="small"
                        type="warning" class="children-tag">
                        {{ data.children.length }}子标签
                    </el-tag>
                </div>
            </template>
        </el-cascader>

        <!-- 标签详情预览（单选模式） -->
        <div v-if="!multiple && selectedTag && showPreview" class="tag-preview">
            <el-card size="small">
                <div class="preview-content">
                    <div class="tag-info">
                        <h4>{{ selectedTag.full_path || selectedTag.name }}</h4>
                        <el-tag v-if="selectedTag.description" type="info" size="small">
                            {{ selectedTag.description }}
                        </el-tag>
                    </div>
                    <div v-if="selectedTag.has_children && selectedTag.children" class="tag-stats">
                        <span class="label">子标签：</span>
                        <el-tag type="warning" size="small">{{ selectedTag.children.length }}个</el-tag>
                    </div>
                </div>
            </el-card>
        </div>

        <!-- 已选标签预览（多选模式） -->
        <div v-if="multiple && selectedValues.length > 0 && showPreview" class="selected-tags-preview">
            <el-tag v-for="tagId in selectedValues" :key="tagId" closable @close="removeTag(tagId)" size="small"
                class="selected-tag" :type="isTagClosed(tagId) ? 'info' : undefined">
                {{ getTagFullPath(tagId) }}
            </el-tag>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { CascaderProps, CascaderValue, CascaderOption } from 'element-plus'
import { fetchTagTree } from '../../api/tags'
import type { Tag, TagSummary } from '../../types/tag'

// Props 定义
interface Props {
    modelValue?: number | number[] | null
    multiple?: boolean
    placeholder?: string
    disabled?: boolean
    showPreview?: boolean
    enabledOnly?: boolean // 是否只显示启用的标签
    knownTags?: TagSummary[] // 已关联的标签摘要，用于展示已禁用的已选标签
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: null,
    multiple: false,
    placeholder: '请选择标签',
    disabled: false,
    showPreview: true,
    enabledOnly: true,
    knownTags: () => []
})

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: number | number[] | null]
    'change': [tags: Tag | Tag[] | null]
}>()

// 响应式数据
const tagTree = ref<Tag[]>([])
type SingleTagValue = CascaderValue | CascaderValue[] | null
const selectedValue = ref<SingleTagValue>(null)
const selectedValues = ref<number[]>([])
const selectedTag = ref<Tag | null>(null)
const loading = ref(false)

const cascaderValue = computed<CascaderValue | undefined>({
    get: () => selectedValue.value === null ? undefined : selectedValue.value as unknown as CascaderValue,
    set: (value) => {
        selectedValue.value = (value ?? null) as SingleTagValue
    }
})

// 级联选择器配置
const cascaderProps: CascaderProps = {
    value: 'id',
    label: 'name',
    children: 'children',
    emitPath: false,
    checkStrictly: true,
    expandTrigger: 'hover'
}

const selectedIds = computed(() => {
    if (props.multiple) {
        return Array.isArray(props.modelValue)
            ? props.modelValue.filter((value): value is number => typeof value === 'number')
            : []
    }
    return typeof props.modelValue === 'number' ? [props.modelValue] : []
})

// 合并标签树与外部传入的已知标签（映射条目自带的标签信息）
const resolvedFlatTags = computed(() => {
    const byId = new Map<number, Tag>()

    const flatten = (tags: Tag[]) => {
        tags.forEach(tag => {
            byId.set(tag.id, tag)
            if (tag.children?.length) {
                flatten(tag.children)
            }
        })
    }
    flatten(tagTree.value)

    props.knownTags.forEach(tag => {
        if (!byId.has(tag.id)) {
            byId.set(tag.id, {
                id: tag.id,
                name: tag.name,
                full_path: tag.full_path,
                enable: tag.enable,
                parent: null,
                description: '',
                owner: 0,
                has_children: false,
                created: '',
                modified: '',
            })
        }
    })

    return Array.from(byId.values())
})

// 计算属性：过滤后的标签选项
const tagOptions = computed<Tag[]>(() => {
    if (!props.enabledOnly) {
        return tagTree.value
    }

    const filtered = filterEnabledTags(structuredClone(tagTree.value) as Tag[])
    if (props.multiple) {
        return filtered
    }

    const selectedId = selectedIds.value[0]
    if (selectedId === undefined) {
        return filtered
    }

    const selectedTag = findTagById(tagTree.value, selectedId)
    if (selectedTag && !selectedTag.enable && !findTagById(filtered, selectedId)) {
        return [...filtered, { ...selectedTag, children: [] }]
    }

    return filtered
})

const cascaderOptions = computed<CascaderOption[]>(() => tagOptions.value as unknown as CascaderOption[])

// 显示启用的标签，并保留已选中的禁用标签以便正确展示名称
const enabledFlatTags = computed(() => {
    if (!props.enabledOnly) {
        return resolvedFlatTags.value
    }

    const enabled = resolvedFlatTags.value.filter(tag => tag.enable)
    const enabledIds = new Set(enabled.map(tag => tag.id))
    const selectedDisabled = resolvedFlatTags.value.filter(
        tag => !tag.enable && selectedIds.value.includes(tag.id) && !enabledIds.has(tag.id)
    )

    return [...enabled, ...selectedDisabled]
})

// 获取标签树形数据
const loadTagTree = async () => {
    try {
        loading.value = true
        const response = await fetchTagTree()

        if (Array.isArray(response.data)) {
            tagTree.value = response.data as Tag[]
        } else {
            console.warn('标签树数据格式异常:', response.data)
            tagTree.value = []
        }
    } catch (error: any) {
        console.error('获取标签树失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error('获取标签数据失败')
        }
        tagTree.value = []
    } finally {
        loading.value = false
    }
}

// 过滤只启用的标签（递归）
const filterEnabledTags = (tags: Tag[]): Tag[] => {
    return tags.filter(tag => {
        if (!tag.enable) return false
        if (tag.children && tag.children.length > 0) {
            tag.children = filterEnabledTags(tag.children)
        }
        return true
    })
}

// 根据ID查找标签（在完整的标签树中查找，包括被禁用的）
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

// 从扁平列表中查找标签（快速查找方法）
const findTagByIdFlat = (id: number): Tag | null => {
    return resolvedFlatTags.value.find(tag => tag.id === id) || null
}

// 获取标签完整路径
const getTagFullPath = (id: number): string => {
    const tag = findTagByIdFlat(id)
    return tag?.full_path || `标签#${id}`
}

const isTagClosed = (id: number): boolean => {
    const tag = findTagByIdFlat(id)
    return tag ? !tag.enable : false
}

// 自定义过滤方法 - 不区分大小写搜索
const customFilterMethod = (node: any, keyword: string) => {
    if (!keyword) return true

    // 将搜索关键词转换为小写
    const lowerKeyword = keyword.toLowerCase()

    // 检查标签名称是否包含关键词（不区分大小写）
    const tagName = node.data.name || ''
    const lowerTagName = tagName.toLowerCase()

    // 检查完整路径是否包含关键词（不区分大小写）
    const fullPath = node.data.full_path || ''
    const lowerFullPath = fullPath.toLowerCase()

    // 检查描述是否包含关键词（不区分大小写）
    const description = node.data.description || ''
    const lowerDescription = description.toLowerCase()

    // 返回匹配结果
    return lowerTagName.includes(lowerKeyword) ||
        lowerFullPath.includes(lowerKeyword) ||
        lowerDescription.includes(lowerKeyword)
}

// 处理选择变化
const normalizeSelectedValue = (value: SingleTagValue): number | null => {
    if (typeof value === 'number') return value
    if (Array.isArray(value)) {
        const latest = value[value.length - 1]
        if (Array.isArray(latest)) {
            const nested = latest[latest.length - 1]
            return typeof nested === 'number' ? nested : null
        }
        return typeof latest === 'number' ? latest : null
    }
    return null
}

const handleChange = () => {
    if (props.multiple) {
        emit('update:modelValue', selectedValues.value)
        const tags = selectedValues.value
            .map(id => findTagByIdFlat(id))
            .filter(Boolean) as Tag[]
        emit('change', tags)
    } else {
        const normalizedValue = normalizeSelectedValue(selectedValue.value)
        emit('update:modelValue', normalizedValue)
        if (normalizedValue !== null) {
            const tag = findTagById(tagTree.value, normalizedValue)
            selectedTag.value = tag
            emit('change', tag)
        } else {
            selectedTag.value = null
            emit('change', null)
        }
    }
}

// 处理下拉框显示状态
const handleVisibleChange = (visible: boolean) => {
    if (visible) {
        loadTagTree()
    }
}

// 移除标签（多选模式）
const removeTag = (tagId: number) => {
    selectedValues.value = selectedValues.value.filter(id => id !== tagId)
    handleChange()
}

watch(selectedIds, (ids) => {
    if (ids.length > 0 && tagTree.value.length === 0) {
        loadTagTree()
    }
}, { immediate: true })

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
    if (props.multiple) {
        if (Array.isArray(newValue)) {
            selectedValues.value = newValue.filter(v => typeof v === 'number')
        } else {
            selectedValues.value = []
        }
    } else {
        const normalizedValue = typeof newValue === 'number' ? newValue : null
        if (normalizedValue !== normalizeSelectedValue(selectedValue.value)) {
            selectedValue.value = normalizedValue ?? null
            if (normalizedValue !== null) {
                const tag = findTagById(tagTree.value, normalizedValue)
                selectedTag.value = tag
            } else {
                selectedTag.value = null
            }
        }
        if (normalizedValue === null) {
            selectedValue.value = null
            selectedTag.value = null
        }
    }
}, { immediate: true })

// 组件挂载时初始化
onMounted(() => {
    if (props.modelValue) {
        loadTagTree().then(() => {
            if (!props.multiple && typeof props.modelValue === 'number') {
                const tag = findTagById(tagTree.value, props.modelValue)
                if (tag) {
                    selectedTag.value = tag
                }
            }
        })
    }
})

// 暴露方法供外部调用
defineExpose({
    loadTagTree,
    findTagById: (id: number) => findTagById(tagTree.value, id)
})
</script>

<style scoped>
.tag-selector {
    width: 100%;
}

.tag-cascader {
    width: 100%;
}

.tag-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.tag-label {
    flex: 1;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
}

.tag-option-closed .tag-label,
.tag-option-closed .node-label {
    color: var(--el-text-color-secondary);
}

.tag-desc {
    margin: 0;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cascader-node {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.node-label {
    flex: 1;
    font-weight: 500;
}

.desc-tag,
.children-tag {
    margin: 0;
}

/* 标签详情预览 */
.tag-preview {
    margin-top: 12px;
}

.preview-content {
    padding: 8px;
}

.tag-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.tag-info h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.tag-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.label {
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 60px;
}

/* 已选标签预览 */
.selected-tags-preview {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.selected-tag {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .tag-option {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }

    .tag-desc {
        max-width: none;
        width: 100%;
    }

    .tag-info {
        flex-direction: column;
        align-items: flex-start;
    }

    .tag-stats {
        flex-wrap: wrap;
    }
}
</style>
