<template>
    <div class="mapping-management">
        <!-- 匿名用户提示 -->
        <AnonymousPrompt v-model="showAnonymousPrompt" @skip="handleSkipAnonymous" />

        <!-- 快速创建映射 -->
        <!-- <div class="quick-create-section">
            <el-button type="primary" size="large" @click="showQuickCreateDialog">
                <el-icon>
                    <Plus />
                </el-icon>
                快速创建映射
            </el-button>
        </div> -->


        <!-- 映射分析面板 -->
        <!-- <div class="analytics-panel">
            <el-card>
                <template #header>
                    <div class="card-header">
                        <span>映射分析</span>
                        <el-button size="small" @click="refreshAnalytics">
                            <el-icon>
                                <Refresh />
                            </el-icon>
                            刷新分析
                        </el-button>
                    </div>
                </template>
                <div class="analytics-content">
                    <el-row :gutter="16">
                        <el-col :xs="24" :sm="12" :md="8">
                            <div class="analytics-card">
                                <div class="analytics-title">映射使用频率</div>
                                <div class="analytics-chart">
                                    <div class="chart-placeholder">
                                        <el-icon>
                                            <PieChart />
                                        </el-icon>
                                        <p>使用频率分析图表</p>
                                        <small>显示最常用和最少用的映射规则</small>
                                    </div>
                                </div>
                            </div>
                        </el-col>
                        <el-col :xs="24" :sm="12" :md="8">
                            <div class="analytics-card">
                                <div class="analytics-title">映射效果评估</div>
                                <div class="analytics-metrics">
                                    <div class="metric-item">
                                        <span class="metric-label">高准确率映射</span>
                                        <span class="metric-value">-</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">需要优化映射</span>
                                        <span class="metric-value warning">-</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">从未使用映射</span>
                                        <span class="metric-value danger">-</span>
                                    </div>
                                </div>
                            </div>
                        </el-col>
                        <el-col :xs="24" :sm="12" :md="8">
                            <div class="analytics-card">
                                <div class="analytics-title">智能建议</div>
                                <div class="analytics-suggestions">
                                    <div class="no-suggestions">
                                        <el-icon>
                                            <InfoFilled />
                                        </el-icon>
                                        <p>等待分析接口接入</p>
                                        <small>后续将提供智能建议</small>
                                    </div>
                                </div>
                            </div>
                        </el-col>
                    </el-row>
                </div>
            </el-card>
        </div> -->

        <!-- 映射类型标签页 -->
        <div class="mapping-tabs">
            <el-tabs v-model="activeTab" @tab-change="handleTabChange">
                <el-tab-pane label="支出映射" name="expense">
                    <template #label>
                        <span class="tab-label">
                            <el-icon>
                                <Money />
                            </el-icon>
                            支出映射
                        </span>
                    </template>
                    <ExpenseMapping ref="expenseMappingRef" />
                </el-tab-pane>

                <el-tab-pane label="收入映射" name="income">
                    <template #label>
                        <span class="tab-label">
                            <el-icon>
                                <TrendCharts />
                            </el-icon>
                            收入映射
                        </span>
                    </template>
                    <IncomeMapping ref="incomeMappingRef" />
                </el-tab-pane>

                <el-tab-pane label="资产映射" name="assets">
                    <template #label>
                        <span class="tab-label">
                            <el-icon>
                                <Wallet />
                            </el-icon>
                            资产映射
                        </span>
                    </template>
                    <AssetsMapping ref="assetsMappingRef" />
                </el-tab-pane>
            </el-tabs>
        </div>

        <!-- 快速创建映射对话框 -->
        <el-dialog v-model="quickCreateDialog" title="快速创建映射" width="600px">
            <!-- 提示信息 -->
            <el-alert v-if="showTooltip" :title="payeetipContent" type="info" :closable="false" show-icon
                style="margin-bottom: 20px;" />

            <el-form :model="quickCreateForm" :rules="quickCreateRules" ref="quickCreateFormRef" label-width="100px">
                <el-form-item label="映射类型" prop="type">
                    <el-select v-model="quickCreateForm.type" placeholder="选择映射类型">
                        <el-option label="支出映射" value="expense" />
                        <el-option label="收入映射" value="income" />
                        <el-option label="资产映射" value="assets" />
                    </el-select>
                </el-form-item>
                <el-form-item label="关键字" prop="key">
                    <el-input v-model="quickCreateForm.key" placeholder="输入关键字" />
                </el-form-item>
                <el-form-item v-if="quickCreateForm.type === 'expense'" label="对方" prop="payee">
                    <el-input v-model="quickCreateForm.payee" placeholder="如腾讯、星巴克" />
                </el-form-item>
                <!-- <el-form-item v-if="quickCreateForm.type === 'income'" label="付款方" prop="payer">
                    <el-input v-model="quickCreateForm.payer" placeholder="输入付款方（可选）" />
                </el-form-item> -->
                <el-form-item label="映射账户" prop="accountId">
                    <AccountSelector v-model="quickCreateForm.accountId" placeholder="请选择或搜索账户"
                        @change="handleAccountChange" />
                </el-form-item>
                <el-form-item v-if="quickCreateForm.type === 'expense'" label="货币代码" prop="currency">
                    <el-input v-model="quickCreateForm.currency" placeholder="如 CNY、USD" clearable>
                        <template #prepend>货币</template>
                    </el-input>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="quickCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="handleQuickCreate">创建</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    Plus, Money, TrendCharts, Wallet, Refresh, PieChart, InfoFilled
} from '@element-plus/icons-vue'
import axios from '../../utils/request'
import AccountSelector from '../common/AccountSelector.vue'
import ExpenseMapping from './Expenses.vue'
import IncomeMapping from './Income.vue'
import AssetsMapping from './Assets.vue'
import AnonymousPrompt from '../common/AnonymousPrompt.vue'
import { hasAuthTokens } from '../../utils/auth'
import { extractApiErrorMessage } from '../../utils/errorHelper'
import { shouldShowAnonymousPrompt } from '~/composables/useAnonymousPrompt'
import type { FormInstance, FormRules, TabPaneName } from 'element-plus'

// 响应式数据
const activeTab = ref('expense')

// 提示信息
const showTooltip = ref(true)
const payeetipContent = ref("💡 提示：关键字用于匹配账单中的描述信息，映射账户用于指定该交易应归入的账户。对方信息有助于提高映射的准确性。")

// 匿名用户提示
const showAnonymousPrompt = ref(false)

// 快速创建相关
const quickCreateDialog = ref(false)
const quickCreateFormRef = ref<FormInstance>()
const quickCreateForm = ref({
    type: 'expense',
    key: '',
    accountId: null as number | null,
    currency: null as string | null,
    payee: '',
    payer: ''
})

const quickCreateRules: FormRules = {
    type: [{ required: true, message: '请选择映射类型', trigger: 'change' }],
    key: [{ required: true, message: '请输入关键字', trigger: 'blur' }],
    accountId: [{ required: true, message: '请选择映射账户', trigger: 'change' }]
}

// 组件引用
const expenseMappingRef = ref()
const incomeMappingRef = ref()
const assetsMappingRef = ref()


// 根据映射类型获取账户类型
// const getAccountTypeByMappingType = (type: string): string => {
//     const typeMap: Record<string, string> = {
//         'expense': 'Expenses',
//         'income': 'Income',
//         'assets': 'Assets'
//     }
//     const accountType = typeMap[type] || ''
//     console.log('映射管理总览 - 映射类型:', type, '-> 账户类型:', accountType)
//     return accountType
// }

// 处理标签页切换
const handleTabChange = (tabName: TabPaneName) => {
    activeTab.value = typeof tabName === 'string' ? tabName : String(tabName)
}

// 显示快速创建对话框
const showQuickCreateDialog = () => {
    quickCreateForm.value = {
        type: 'expense',
        key: '',
        accountId: null,
        currency: null,
        payee: '',
        payer: ''
    }
    quickCreateDialog.value = true
}

// 处理快速创建
const handleQuickCreate = async () => {
    if (!quickCreateFormRef.value) return

    try {
        await quickCreateFormRef.value.validate()

        // 根据映射类型转换字段名
        let formData: any = {
            key: quickCreateForm.value.key,
            currency: quickCreateForm.value.currency
        }

        let apiUrl = ''
        switch (quickCreateForm.value.type) {
            case 'expense':
                apiUrl = '/expense/'
                formData.payee = quickCreateForm.value.payee
                formData.expend_id = quickCreateForm.value.accountId // 转换为 expend_id
                break
            case 'income':
                apiUrl = '/income/'
                formData.payer = quickCreateForm.value.payer
                formData.income_id = quickCreateForm.value.accountId // 转换为 income_id
                break
            case 'assets':
                apiUrl = '/assets/'
                formData.assets_id = quickCreateForm.value.accountId // 转换为 assets_id
                break
        }

        console.log('快速创建映射数据:', formData)

        await axios.post(apiUrl, formData)
        ElMessage.success('映射创建成功')
        quickCreateDialog.value = false

        // 刷新当前标签页数据
        await refreshCurrentTab()
    } catch (error: any) {
        console.error('创建映射失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else if (error.response?.status === 400) {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '创建失败，请检查数据格式'))
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '创建映射失败'))
        }
    }
}

// 刷新当前标签页数据
const refreshCurrentTab = async () => {
    switch (activeTab.value) {
        case 'expense':
            if (expenseMappingRef.value?.fetchData) {
                await expenseMappingRef.value.fetchData()
            }
            break
        case 'income':
            if (incomeMappingRef.value?.fetchData) {
                await incomeMappingRef.value.fetchData()
            }
            break
        case 'assets':
            if (assetsMappingRef.value?.fetchData) {
                await assetsMappingRef.value.fetchData()
            }
            break
    }
}


// 刷新分析数据
const refreshAnalytics = async () => {
    ElMessage.info('正在刷新分析数据...')
    // 这里后续会调用您提供的接口
    ElMessage.success('分析数据已刷新')
}

// 处理账户选择变化
const handleAccountChange = (account: any) => {
    console.log('映射管理总览 - 账户选择变化:', account)
    // 账户选择变化时，清空已选择的货币
    quickCreateForm.value.currency = null
}

// 处理匿名用户跳过提示
const handleSkipAnonymous = () => {
    showAnonymousPrompt.value = false
    // 继续显示映射管理页面，显示admin用户的共享配置
    // 加载所有标签页的数据
    loadAllTabData()
}

// 加载所有标签页数据
const loadAllTabData = () => {
    // 加载支出映射数据
    if (expenseMappingRef.value?.fetchData) {
        expenseMappingRef.value.fetchData()
    }
    // 加载收入映射数据
    if (incomeMappingRef.value?.fetchData) {
        incomeMappingRef.value.fetchData()
    }
    // 加载资产映射数据
    if (assetsMappingRef.value?.fetchData) {
        assetsMappingRef.value.fetchData()
    }
}

// 组件挂载时初始化
onMounted(() => {
    // 检查用户是否已登录
    const isAuthenticated = hasAuthTokens()

    if (!isAuthenticated) {
        // 未登录用户：检查是否应该显示提示（仅显示一次）
        if (shouldShowAnonymousPrompt(false)) {
            showAnonymousPrompt.value = true
        }
        // 如果用户已经看过提示，直接显示页面，显示admin用户的共享配置
    }
    // 页面初始化
})
</script>

<style scoped>
.mapping-management {
    padding: 20px;
    background-color: var(--ep-bg-color);
    min-height: 100vh;
}

.quick-create-section {
    margin-bottom: 24px;
    text-align: center;
}

.analytics-panel {
    margin-bottom: 24px;
}

.analytics-content {
    padding: 16px 0;
}

.analytics-card {
    background: var(--ep-fill-color-light);
    border-radius: 8px;
    padding: 16px;
    height: 100%;
}

.analytics-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--ep-text-color-primary);
    margin-bottom: 16px;
}

.analytics-chart {
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.chart-placeholder {
    text-align: center;
    color: var(--ep-text-color-secondary);
}

.chart-placeholder .el-icon {
    font-size: 32px;
    margin-bottom: 8px;
}

.chart-placeholder p {
    margin: 8px 0 4px 0;
    font-size: 14px;
}

.chart-placeholder small {
    font-size: 12px;
    color: var(--ep-text-color-placeholder);
}

.analytics-metrics {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.metric-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--ep-bg-color);
    border-radius: 6px;
    border-left: 3px solid var(--ep-color-primary);
}

.metric-label {
    font-size: 14px;
    color: var(--ep-text-color-regular);
}

.metric-value {
    font-size: 16px;
    font-weight: 600;
    color: var(--ep-color-success);
}

.metric-value.warning {
    color: var(--ep-color-warning);
}

.metric-value.danger {
    color: var(--ep-color-danger);
}

.analytics-suggestions {
    min-height: 120px;
}

.no-suggestions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--ep-color-success);
}

.no-suggestions .el-icon {
    font-size: 24px;
    margin-bottom: 8px;
}

.no-suggestions p {
    margin: 0;
    font-size: 14px;
}

.suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.suggestion-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    background: var(--ep-bg-color);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.4;
}

.suggestion-item .el-icon {
    margin-top: 2px;
    flex-shrink: 0;
}

.suggestion-item .el-icon.warning {
    color: var(--ep-color-warning);
}

.suggestion-item .el-icon.info {
    color: var(--ep-color-primary);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}


.mapping-tabs {
    background: var(--ep-bg-color);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab-label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tab-badge {
    margin-left: 4px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .mapping-management {
        padding: 12px;
    }

    .card-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }
}
</style>
