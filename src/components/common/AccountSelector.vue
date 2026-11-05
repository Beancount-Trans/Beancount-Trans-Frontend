<template>
    <div class="account-selector">
        <el-cascader v-model="cascaderValue" :options="accountOptions" :props="cascaderProps" :placeholder="placeholder"
            :filterable="true" :filter-method="customFilterMethod" :clearable="true" :show-all-levels="false"
            :separator="' > '" @change="handleChange" @visible-change="handleVisibleChange" class="account-cascader"
            style="width: 100%;">
            <template #default="{ node, data }">
                <div class="cascader-node">
                    <span class="node-label">{{ data.account }}</span>
                    <template v-if="showDetails">
                        <el-tag v-if="node.level === 1 && data.account_type"
                            :type="getAccountTypeColor(data.account_type)" size="small" class="node-tag">
                            {{ data.account_type }}
                        </el-tag>
                        <el-tag v-else-if="node.level > 1 && data.description" type="info" size="small"
                            class="node-tag">
                            {{ data.description }}
                        </el-tag>
                    </template>
                </div>
            </template>
        </el-cascader>

        <!-- 账户详情预览：完整卡片（映射编辑）或仅描述标签（差额分配等表格内选择） -->
        <div v-if="showPreview && selectedAccount" class="account-preview" :class="{ 'is-compact': compact }">
            <el-card v-if="!compact" size="small">
                <div class="preview-content">
                    <div class="account-info">
                        <div class="account-path">{{ selectedAccount.account }}</div>
                        <div class="account-meta">
                            <el-tag v-if="selectedAccount.account_type"
                                :type="getAccountTypeColor(selectedAccount.account_type)">
                                {{ selectedAccount.account_type }}
                            </el-tag>
                            <el-tag v-if="selectedAccount.description" type="info">
                                {{ selectedAccount.description }}
                            </el-tag>
                        </div>
                    </div>
                </div>
            </el-card>
            <div v-else class="account-meta">
                <el-tag type="info" size="small">
                    {{ selectedAccount.description }}
                </el-tag>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import type { CascaderProps, CascaderValue, CascaderOption } from 'element-plus'
import axios from '../../utils/request'
import { subscribeAccountTreeUpdated } from '~/utils/accountEvents'
import { getAccountTypeColor } from '~/utils/accountTypeColor'
import { groupAccountsByRoot, type AccountTreeNode } from '~/utils/accountTree'

// 接口定义
interface AccountBase {
    id: number | string
    account: string
    parent?: number
    parent_account?: string
    account_type: string
    description?: string
    enable: boolean
    is_virtual?: boolean
    mapping_count?: {
        expense: number
        assets: number
        income: number
        total: number
    }
    children?: AccountOption[]
}

type AccountOption = AccountBase & CascaderOption

// Props
interface Props {
    modelValue?: number | null | undefined
    accountType?: string // 过滤账户类型：'Expenses', 'Income', 'Assets'
    placeholder?: string
    disabled?: boolean
    showDetails?: boolean // 是否显示账户类型、描述等详细信息
    /** 紧凑模式：选中后只展示类型/描述标签，不展示预览卡片（用于表格单元格） */
    compact?: boolean
    /** 外部注入的账户树；传入且非空时使用该数据，不再请求 tree/ */
    accountTree?: AccountOption[] | null
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: null,
    accountType: '',
    placeholder: '请选择账户',
    disabled: false,
    showDetails: true,
    compact: false,
    accountTree: undefined
})

// Emits
const emit = defineEmits<{
    'update:modelValue': [value: number | null]
    'change': [account: AccountOption | null]
}>()

// 响应式数据
const internalAccountTree = ref<AccountOption[]>([])
type InternalCascaderValue = CascaderValue | CascaderValue[] | null

// 是否由父组件注入账户树（传入即视为注入，即使为空也不自行请求）
const hasInjectedTree = computed(() => props.accountTree != null)
// 实际用于选项的树：优先使用注入的树；展示层按五类账户合成虚拟根节点
const effectiveAccountTree = computed<AccountOption[]>(() => {
    const tree = hasInjectedTree.value ? (props.accountTree ?? []) : internalAccountTree.value
    return groupAccountsByRoot(tree as unknown as AccountTreeNode[]) as unknown as AccountOption[]
})
const selectedValue = ref<InternalCascaderValue>(props.modelValue ?? null)

const cascaderValue = computed<CascaderValue | undefined>({
    get: () => selectedValue.value === null ? undefined : selectedValue.value as unknown as CascaderValue,
    set: (value) => {
        selectedValue.value = (value ?? null) as InternalCascaderValue
    }
})
const selectedAccount = ref<AccountOption | null>(null)
const loading = ref(false)

const showPreview = computed(() => {
    if (!props.showDetails || !selectedAccount.value) return false
    if (props.compact) return Boolean(selectedAccount.value.description)
    return Boolean(selectedAccount.value.account_type || selectedAccount.value.description)
})
let unsubscribeAccountTreeUpdated: (() => void) | null = null

// 级联选择器配置
const cascaderProps: CascaderProps = {
    value: 'id',
    label: 'account',
    children: 'children',
    emitPath: false,
    checkStrictly: true,
    expandTrigger: 'hover',
    // 虚拟根节点只用于分组，不能被选中
    disabled: (data: CascaderOption) => Boolean((data as AccountOption).is_virtual)
}

// 计算属性：过滤后的账户选项
const accountOptions = computed<AccountOption[]>(() => {
    if (!props.accountType) {
        return effectiveAccountTree.value
    }
    return filterAccountsByType(effectiveAccountTree.value, props.accountType)
})

// 获取账户树形数据
const fetchAccountTree = async () => {
    try {
        loading.value = true
        const response = await axios.get('/account/tree/')
        console.log('账户树数据:', response.data) // 调试日志

        // 确保数据是数组格式
        if (Array.isArray(response.data)) {
            internalAccountTree.value = response.data as AccountOption[]
        } else if (response.data && Array.isArray(response.data.results)) {
            internalAccountTree.value = response.data.results as AccountOption[]
        } else {
            console.warn('账户树数据格式异常:', response.data)
            internalAccountTree.value = []
        }

        const normalized = normalizeCascaderValue(selectedValue.value)
        if (normalized !== null) {
            const account = findAccountById(internalAccountTree.value, normalized)
            selectedAccount.value = account
        }
    } catch (error: any) {
        console.error('获取账户树失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error('获取账户数据失败')
        }
        internalAccountTree.value = []
    } finally {
        loading.value = false
    }
}

// 根据账户类型过滤账户
const filterAccountsByType = (accounts: AccountOption[], type: string): AccountOption[] => {
    // 账户类型映射：英文 -> 中文
    const typeMapping: Record<string, string> = {
        'Assets': '资产账户',
        'Expenses': '支出账户',
        'Income': '收入账户',
        'Liabilities': '负债账户',
        'Equity': '权益账户'
    }

    const chineseType = typeMapping[type] || type

    return accounts.filter(account => {
        if (account.account_type === chineseType) return true
        if (account.children) {
            account.children = filterAccountsByType(account.children, type)
            return account.children.length > 0
        }
        return false
    })
}

// 查找账户对象
const findAccountById = (accounts: AccountOption[], id: number | string): AccountOption | null => {
    for (const account of accounts) {
        if (account.id === id) return account
        if (account.children) {
            const found = findAccountById(account.children, id)
            if (found) return found
        }
    }
    return null
}

// 获取账户类型颜色
// 自定义过滤方法 - 不区分大小写搜索
const customFilterMethod = (node: any, keyword: string) => {
    if (!keyword) return true

    // 将搜索关键词转换为小写
    const lowerKeyword = keyword.toLowerCase()

    // 检查账户名称是否包含关键词（不区分大小写）
    const accountName = node.data.account || ''
    const lowerAccountName = accountName.toLowerCase()

    // 检查账户类型是否包含关键词（不区分大小写）
    const accountType = node.data.account_type || ''
    const lowerAccountType = accountType.toLowerCase()

    // 检查账户描述是否包含关键词（不区分大小写）
    const description = node.data.description || ''
    const lowerDescription = description.toLowerCase()

    // 返回匹配结果
    return lowerAccountName.includes(lowerKeyword) || lowerAccountType.includes(lowerKeyword) || lowerDescription.includes(lowerKeyword)
}

// 处理选择变化
const normalizeCascaderValue = (value: InternalCascaderValue): number | null => {
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

const handleChange = async (value: CascaderValue | CascaderValue[] | null | undefined) => {
    const normalizedValue = normalizeCascaderValue(value ?? null)
    selectedValue.value = (value ?? null) as InternalCascaderValue

    // 先更新 modelValue，确保值不会丢失
    emit('update:modelValue', normalizedValue)

    if (normalizedValue !== null) {
        // 未注入账户树且本地树为空、不在加载中时，先加载
        if (!hasInjectedTree.value && internalAccountTree.value.length === 0 && !loading.value) {
            await fetchAccountTree()
        }

        // 尝试查找账户对象（优先用当前有效树）
        let account = findAccountById(effectiveAccountTree.value, normalizedValue)

        // 如果找不到且正在加载中且未使用注入树，等待加载完成后再查找
        if (!account && !hasInjectedTree.value && loading.value) {
            await new Promise<void>((resolve) => {
                const unwatch = watch(loading, (isLoading) => {
                    if (!isLoading) {
                        unwatch()
                        resolve()
                    }
                })
                setTimeout(() => {
                    unwatch()
                    resolve()
                }, 2000)
            })
            account = findAccountById(internalAccountTree.value, normalizedValue)
        }

        selectedAccount.value = account
        emit('change', account)
    } else {
        selectedAccount.value = null
        emit('change', null)
    }
}

// 处理下拉框显示状态
const handleVisibleChange = (visible: boolean) => {
    // 未注入树时：下拉打开且本地树为空且不在加载中，才请求
    if (visible && !hasInjectedTree.value && internalAccountTree.value.length === 0 && !loading.value) {
        fetchAccountTree()
    }
}

function syncSelectedAccount(id: number | null) {
    if (id == null) {
        selectedAccount.value = null
        return
    }
    selectedAccount.value = findAccountById(effectiveAccountTree.value, id)
}

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
    if (normalizeCascaderValue(selectedValue.value) !== (newValue ?? null)) {
        selectedValue.value = newValue ?? null
    }
    syncSelectedAccount(newValue ?? null)
}, { immediate: true })

// 注入的账户树异步到位后，补全选中账户的类型/描述
watch(effectiveAccountTree, () => {
    const id = normalizeCascaderValue(selectedValue.value) ?? (props.modelValue ?? null)
    syncSelectedAccount(id)
})

// 组件挂载时初始化
onMounted(() => {
    unsubscribeAccountTreeUpdated = subscribeAccountTreeUpdated(() => {
        if (!hasInjectedTree.value) {
            fetchAccountTree()
        }
    })

    // 已注入账户树时直接根据当前值解析 selectedAccount，不请求
    if (hasInjectedTree.value) {
        if (props.modelValue) {
            const account = findAccountById(effectiveAccountTree.value, props.modelValue)
            if (account) selectedAccount.value = account
        }
        const normalized = normalizeCascaderValue(selectedValue.value)
        if (normalized !== null) {
            const account = findAccountById(effectiveAccountTree.value, normalized)
            if (account) selectedAccount.value = account
        }
        return
    }

    // 未注入时：异步预加载账户树
    const loadAccountTreeAsync = () => {
        fetchAccountTree().then(() => {
            if (props.modelValue) {
                const account = findAccountById(internalAccountTree.value, props.modelValue!)
                if (account) selectedAccount.value = account
            }
            const normalized = normalizeCascaderValue(selectedValue.value)
            if (normalized !== null) {
                const account = findAccountById(internalAccountTree.value, normalized)
                if (account) selectedAccount.value = account
            }
        })
    }

    nextTick(() => {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(loadAccountTreeAsync, { timeout: 2000 })
        } else {
            setTimeout(loadAccountTreeAsync, 100)
        }
    })
})

onBeforeUnmount(() => {
    if (unsubscribeAccountTreeUpdated) {
        unsubscribeAccountTreeUpdated()
        unsubscribeAccountTreeUpdated = null
    }
})
</script>

<style scoped>
.account-selector {
    width: 100%;
}

.account-cascader {
    width: 100%;
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

.node-tag {
    margin: 0;
}

.account-preview {
    margin-top: 12px;
}

.account-preview.is-compact {
    margin-top: 8px;
}

.preview-content {
    padding: 8px;
}

.account-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 8px;
}

.account-path {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--el-text-color-primary, #303133);
    word-break: break-word;
}

.account-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.currencies {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.currency-tag {
    margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .currencies {
        flex-wrap: wrap;
    }
}
</style>
