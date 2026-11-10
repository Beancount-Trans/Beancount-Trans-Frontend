<template>
    <div class="account-management">
        <!-- 匿名用户提示 -->
        <AnonymousPrompt v-model="showAnonymousPrompt" @skip="handleSkipAnonymous" />

        <!-- 页面内容，只在非匿名用户或已跳过提示时显示 -->
        <div v-if="!showAnonymousPrompt" class="management-header">
            <h2>账户管理</h2>
            <div class="header-actions">
                <el-button v-if="gitEnabled" @click="openReconcileDialog">
                    <el-icon>
                        <Refresh />
                    </el-icon>
                    账户核对
                </el-button>
                <el-button type="primary" @click="showAddAccountDialog">
                    <el-icon>
                        <Plus />
                    </el-icon>
                    新增账户
                </el-button>
            </div>
        </div>

        <div v-if="!showAnonymousPrompt" class="management-content">
            <!-- 左侧：账户树形结构 -->
            <div class="account-tree-panel">
                <el-input v-model="searchKeyword" class="account-search" placeholder="搜索账户路径或描述" :prefix-icon="Search"
                    clearable />
                <el-tree ref="accountTreeRef" :key="accountTreeRenderKey" :data="accountTree" :props="treeProps"
                    node-key="id" :expand-on-click-node="false" :default-expand-all="false"
                    :default-expanded-keys="expandedKeys" :current-node-key="currentSelectedAccountId ?? undefined"
                    :filter-node-method="filterAccountNode" highlight-current class="account-tree" v-loading="loading"
                    @node-click="handleNodeClick" @node-expand="handleNodeExpand" @node-collapse="handleNodeCollapse">
                    <template #default="{ node, data }">
                        <div class="tree-node">
                            <span class="node-label">{{ data.account }}</span>
                            <div v-if="!data.is_virtual" class="node-actions">
                                <el-tag size="small" :type="getAccountTypeColor(data.account_type)">
                                    {{ data.account_type }}
                                </el-tag>
                                <el-tag v-if="data.mapping_count && data.mapping_count.total > 0" size="small"
                                    type="info">
                                    {{ data.mapping_count.total }}映射
                                </el-tag>
                                <el-switch v-model="data.enable" size="small" @change="updateAccountStatus(data)"
                                    style="margin-left: 8px;" />
                            </div>
                        </div>
                    </template>
                </el-tree>
            </div>

            <!-- 右侧：账户详情和货币管理 -->
            <div class="account-detail-panel">
                <div v-if="selectedAccount" class="account-detail">
                    <div class="account-title">
                        <h3>{{ selectedAccount.account }}</h3>
                        <el-tooltip v-if="selectedAccount.is_ledger_closed" placement="top" effect="dark"
                            content="账本中已 close，平台记录可直接删除；无需再同步或配对">
                            <el-tag size="small" type="warning" effect="plain">
                                账本已关闭
                            </el-tag>
                        </el-tooltip>
                        <el-tooltip v-else-if="selectedAccount.is_ledger_custodied" placement="top" effect="dark"
                            content="该账户由账本管理：改名、币种与删除需在账本中处理，改完同步后可用「账户核对」确认">
                            <el-tag size="small" type="info" effect="plain">
                                账本管理
                            </el-tag>
                        </el-tooltip>
                    </div>

                    <!-- 账户基本信息 -->
                    <el-card class="info-card">
                        <template #header>
                            <span>基本信息</span>
                        </template>
                        <el-descriptions :column="2" border>
                            <el-descriptions-item label="账户类型">
                                <el-tag :type="getAccountTypeColor(selectedAccount.account_type)">
                                    {{ selectedAccount.account_type }}
                                </el-tag>
                            </el-descriptions-item>
                            <el-descriptions-item label="启用状态">
                                <el-switch v-model="selectedAccount.enable"
                                    @change="updateAccountStatus(selectedAccount)" />
                            </el-descriptions-item>
                            <el-descriptions-item label="映射统计" v-if="selectedAccount.mapping_count">
                                <div class="mapping-stats">
                                    <el-tooltip v-if="selectedAccount.mapping_count.expense > 0"
                                        :content="getExpenseMappingTooltip()" placement="top" effect="dark">
                                        <el-tag type="warning" style="cursor: help;">
                                            {{ selectedAccount.mapping_count.expense }}支出
                                        </el-tag>
                                    </el-tooltip>
                                    <el-tooltip v-if="selectedAccount.mapping_count.assets > 0"
                                        :content="getAssetsMappingTooltip()" placement="top" effect="dark">
                                        <el-tag type="success" style="cursor: help;">
                                            {{ selectedAccount.mapping_count.assets }}资产
                                        </el-tag>
                                    </el-tooltip>
                                    <el-tooltip v-if="selectedAccount.mapping_count.income > 0"
                                        :content="getIncomeMappingTooltip()" placement="top" effect="dark">
                                        <el-tag type="primary" style="cursor: help;">
                                            {{ selectedAccount.mapping_count.income }}收入
                                        </el-tag>
                                    </el-tooltip>
                                    <el-tag type="info">{{ selectedAccount.mapping_count.total }}总计</el-tag>
                                    <el-button v-if="selectedAccount.mapping_count.total > 0" size="small" type="text"
                                        @click="toggleMappingDetails" style="margin-left: 8px;">
                                        {{ showMappingDetails ? '收起详情' : '查看详情' }}
                                    </el-button>
                                </div>
                            </el-descriptions-item>
                            <!-- <el-descriptions-item label="父账户" v-if="selectedAccount.parent_account">
                                {{ selectedAccount.parent_account }}
                            </el-descriptions-item> -->
                            <el-descriptions-item label="对账周期" v-if="shouldShowReconciliationCycle(selectedAccount)">
                                <span
                                    v-if="accountMappings.reconciliation_cycle_display && accountMappings.reconciliation_cycle_display !== '未设置'">
                                    {{ accountMappings.reconciliation_cycle_display }}
                                </span>
                                <span v-else-if="selectedAccount.reconciliation_rule" class="reconciliation-rule-text">
                                    {{ selectedAccount.reconciliation_rule }}
                                </span>
                                <span v-else style="color: var(--ep-text-color-secondary);">未设置</span>
                            </el-descriptions-item>
                            <el-descriptions-item label="币种" v-if="shouldShowCurrency(selectedAccount)">
                                {{ selectedAccount.currency || '不限制' }}
                            </el-descriptions-item>
                            <el-descriptions-item label="描述">
                                {{ selectedAccount.description || '-' }}
                            </el-descriptions-item>
                            <el-descriptions-item label="创建时间">
                                {{ formatDateTime(selectedAccount.created) }}
                            </el-descriptions-item>
                        </el-descriptions>
                    </el-card>

                    <!-- 映射详情 -->
                    <el-card
                        v-if="showMappingDetails && selectedAccount.mapping_count && selectedAccount.mapping_count.total > 0"
                        class="mapping-details-card">
                        <template #header>
                            <div class="mapping-header">
                                <span>映射详情</span>
                                <el-tag
                                    v-if="accountMappings.reconciliation_cycle_display && accountMappings.reconciliation_cycle_display !== '未设置'"
                                    type="info" size="small">
                                    对账周期：{{ accountMappings.reconciliation_cycle_display }}
                                </el-tag>
                            </div>
                        </template>
                        <div class="mapping-details-content" v-loading="mappingDetailsLoading">
                            <el-tabs v-model="activeMappingTab" type="card">
                                <!-- 支出映射 -->
                                <el-tab-pane label="支出映射" name="expense"
                                    v-if="accountMappings.expense_mappings && accountMappings.expense_mappings.length > 0">
                                    <div class="mapping-list">
                                        <div v-for="mapping in accountMappings.expense_mappings" :key="mapping.id"
                                            class="mapping-item">
                                            <div class="mapping-info">
                                                <span class="mapping-key">{{ mapping.key }}</span>
                                                <span class="mapping-account">→ {{ selectedAccount?.account }}</span>
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
                                    v-if="accountMappings.assets_mappings && accountMappings.assets_mappings.length > 0">
                                    <div class="mapping-list">
                                        <div v-for="mapping in accountMappings.assets_mappings" :key="mapping.id"
                                            class="mapping-item">
                                            <div class="mapping-info">
                                                <span class="mapping-key">{{ mapping.key }}</span>
                                                <span class="mapping-account">→ {{ selectedAccount?.account }}</span>
                                            </div>
                                            <el-tag :type="mapping.enable ? 'success' : 'info'" size="small">
                                                {{ mapping.enable ? '启用' : '禁用' }}
                                            </el-tag>
                                        </div>
                                    </div>
                                </el-tab-pane>

                                <!-- 收入映射 -->
                                <el-tab-pane label="收入映射" name="income"
                                    v-if="accountMappings.income_mappings && accountMappings.income_mappings.length > 0">
                                    <div class="mapping-list">
                                        <div v-for="mapping in accountMappings.income_mappings" :key="mapping.id"
                                            class="mapping-item">
                                            <div class="mapping-info">
                                                <span class="mapping-key">{{ mapping.key }}</span>
                                                <span class="mapping-account">→ {{ selectedAccount?.account }}</span>
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
                    <div class="action-buttons">
                        <el-button type="primary" @click="editAccount">
                            <el-icon>
                                <Edit />
                            </el-icon>
                            编辑账户
                        </el-button>
                        <el-tooltip
                            :disabled="Boolean(!selectedAccount.is_ledger_custodied || selectedAccount.is_ledger_closed)"
                            content="该账户由账本管理，请先在账本中删除并同步" placement="top">
                            <span>
                                <el-button type="danger"
                                    :disabled="Boolean(selectedAccount.is_ledger_custodied && !selectedAccount.is_ledger_closed)"
                                    @click="deleteAccount">
                                    <el-icon>
                                        <Delete />
                                    </el-icon>
                                    删除账户
                                </el-button>
                            </span>
                        </el-tooltip>
                    </div>
                </div>

                <el-empty v-else description="请选择账户查看详情" />
            </div>
        </div>

        <!-- 新增账户对话框 -->
        <el-dialog v-model="addAccountDialog" title="新增账户" width="500px">
            <el-form :model="newAccount" :rules="addAccountRules" ref="accountForm" label-width="120px">
                <el-form-item label="账户路径" prop="account">
                    <el-input v-model="newAccount.account" placeholder="Assets:Savings:Bank" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="newAccount.description" maxlength="256" placeholder="早餐" />
                </el-form-item>
                <el-form-item label="币种" v-if="shouldShowCurrencyForNewAccount()">
                    <el-select :model-value="splitCurrencies(newAccount.currency)"
                        @update:model-value="(v: string[]) => newAccount.currency = v.join(',')" multiple filterable
                        allow-create default-first-option :reserve-keyword="false" placeholder="留空表示不限制，可输入多个">
                        <el-option v-for="code in COMMON_CURRENCIES" :key="code" :label="code" :value="code" />
                    </el-select>
                </el-form-item>
                <template v-if="shouldShowReconciliationCycleForNewAccount()">
                    <el-divider content-position="left">对账周期设置（可选）</el-divider>
                    <el-form-item label="对账规则" prop="reconciliation_rule">
                        <RecurrenceRuleInput v-model="newAccount.reconciliation_rule" :show-preview="false" />
                        <div class="cycle-presets">
                            <el-button v-for="preset in RECONCILIATION_CYCLE_PRESETS" :key="preset.rule" size="small"
                                class="preset-btn" @click="newAccount.reconciliation_rule = preset.rule">
                                {{ preset.label }}
                            </el-button>
                        </div>
                    </el-form-item>
                </template>
            </el-form>
            <template #footer>
                <el-button @click="addAccountDialog = false">取消</el-button>
                <el-button type="primary" @click="createAccount">确定</el-button>
            </template>
        </el-dialog>

        <!-- 编辑账户对话框 -->
        <el-dialog v-model="editAccountDialog" title="编辑账户" width="500px">
            <el-form :model="editAccountForm" :rules="editAccountRules" ref="editAccountFormRef" label-width="120px">
                <el-form-item label="账户路径" prop="account">
                    <el-input v-model="editAccountForm.account" :disabled="selectedAccount?.is_ledger_custodied" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="editAccountForm.description" maxlength="256" placeholder="早餐" />
                </el-form-item>
                <el-form-item label="币种" v-if="shouldShowCurrency(selectedAccount)">
                    <el-select :model-value="splitCurrencies(editAccountForm.currency)"
                        :disabled="selectedAccount?.is_ledger_custodied"
                        @update:model-value="(v: string[]) => editAccountForm.currency = v.join(',')" multiple
                        filterable allow-create default-first-option :reserve-keyword="false"
                        placeholder="留空表示不限制，可输入多个">
                        <el-option v-for="code in COMMON_CURRENCIES" :key="code" :label="code" :value="code" />
                    </el-select>
                </el-form-item>
                <template v-if="shouldShowReconciliationCycle(selectedAccount)">
                    <el-divider content-position="left">对账周期设置（可选）</el-divider>
                    <el-form-item label="对账规则" prop="reconciliation_rule">
                        <RecurrenceRuleInput v-model="editAccountForm.reconciliation_rule" :show-preview="false" />
                        <div class="cycle-presets">
                            <el-button v-for="preset in RECONCILIATION_CYCLE_PRESETS" :key="preset.rule" size="small"
                                class="preset-btn" @click="editAccountForm.reconciliation_rule = preset.rule">
                                {{ preset.label }}
                            </el-button>
                        </div>
                    </el-form-item>
                </template>
            </el-form>
            <template #footer>
                <el-button @click="editAccountDialog = false">取消</el-button>
                <el-button type="primary" @click="updateAccount">确定</el-button>
            </template>
        </el-dialog>

        <!-- 删除账户对话框 -->
        <el-dialog v-model="deleteAccountDialog" title="删除账户" width="600px">
            <div v-if="selectedAccount" class="delete-account-content">
                <el-alert :title="`确定要删除账户 '${selectedAccount.account}' 吗？`" type="warning" :closable="false" show-icon
                    style="margin-bottom: 20px;">
                    <template #default>
                        <p>此操作将：</p>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>永久删除该账户</li>
                            <li v-if="selectedAccount.mapping_count && selectedAccount.mapping_count.total > 0">
                                将 {{ selectedAccount.mapping_count.total }} 个映射迁移到目标账户
                            </li>
                            <li v-else>该账户无映射数据，可直接删除</li>
                        </ul>
                    </template>
                </el-alert>

                <!-- 映射迁移选择 -->
                <div v-if="selectedAccount.mapping_count && selectedAccount.mapping_count.total > 0"
                    class="migration-section">
                    <h4>选择迁移目标账户</h4>
                    <p class="migration-tip">请选择要将映射迁移到的目标账户：</p>

                    <div class="account-selector">
                        <el-cascader v-model="migrationCascaderValue" :options="migrationCandidates"
                            :props="cascaderProps" placeholder="请选择迁移目标账户" :filterable="true"
                            :filter-method="customFilterMethod" :clearable="true" :show-all-levels="false"
                            :separator="' > '" @change="handleMigrationAccountChange"
                            @visible-change="handleMigrationVisibleChange" class="account-cascader" style="width: 100%;"
                            v-loading="migrationCandidatesLoading">
                            <template #default="{ node, data }">
                                <div class="cascader-node">
                                    <span class="node-label">{{ data.account }}</span>
                                    <el-tag v-if="data.account_type" :type="getAccountTypeColor(data.account_type)"
                                        size="small" class="node-tag">
                                        {{ data.account_type }}
                                    </el-tag>
                                    <el-tag v-if="data.mapping_count && data.mapping_count.total > 0" type="info"
                                        size="small" class="mapping-tag">
                                        {{ data.mapping_count.total }}映射
                                    </el-tag>
                                </div>
                            </template>
                        </el-cascader>

                        <!-- 账户详情预览 -->
                        <div v-if="selectedMigrationAccountInfo" class="account-preview">
                            <el-card size="small">
                                <div class="preview-content">
                                    <div class="account-info">
                                        <h4>{{ selectedMigrationAccountInfo.account }}</h4>
                                        <el-tag :type="getAccountTypeColor(selectedMigrationAccountInfo.account_type)">
                                            {{ selectedMigrationAccountInfo.account_type }}
                                        </el-tag>
                                    </div>
                                    <div v-if="selectedMigrationAccountInfo.mapping_count" class="mapping-stats">
                                        <span class="label">映射统计：</span>
                                        <el-tag type="warning" size="small">{{
                                            selectedMigrationAccountInfo.mapping_count.expense }}支出</el-tag>
                                        <el-tag type="success" size="small">{{
                                            selectedMigrationAccountInfo.mapping_count.assets
                                        }}资产</el-tag>
                                        <el-tag type="primary" size="small">{{
                                            selectedMigrationAccountInfo.mapping_count.income
                                        }}收入</el-tag>
                                    </div>
                                </div>
                            </el-card>
                        </div>
                    </div>

                    <div v-if="migrationCandidates.length === 0 && !migrationCandidatesLoading" class="no-candidates">
                        <el-alert title="无可用迁移目标" type="info" :closable="false" show-icon>
                            <template #default>
                                <p>当前没有可用的迁移目标账户。请先创建其他账户后再进行删除操作。</p>
                            </template>
                        </el-alert>
                    </div>
                </div>

                <!-- 无映射时的提示 -->
                <div v-else class="no-mappings-section">
                    <el-alert title="该账户无映射数据" type="info" :closable="false" show-icon>
                        <template #default>
                            <p>该账户没有任何映射数据，可以直接删除，无需选择迁移目标。</p>
                        </template>
                    </el-alert>
                </div>
            </div>

            <template #footer>
                <el-button @click="deleteAccountDialog = false">取消</el-button>
                <el-button type="danger" @click="confirmDeleteAccount"
                    :disabled="hasMappings && !selectedMigrationAccountId" :loading="deleteAccountLoading">
                    确定删除
                </el-button>
            </template>
        </el-dialog>

        <!-- 账户核对（账本 → 平台） -->
        <el-dialog v-model="reconcileDialog" title="账户核对" width="760px">
            <div v-loading="reconcileLoading" class="reconcile-content">
                <el-alert v-if="!reconcileData.ledger_available" type="warning" :closable="false" show-icon
                    title="账本不可用" description="未找到 main.bean，无法对比账户。" />
                <template v-else>
                    <el-alert type="info" :closable="false" show-icon title="先在账本中改名并同步"
                        description="在这里确认旧 → 新配对；只更新平台账户，不改写账本文件。" />

                    <h4>平台有、账本无（疑似改名）</h4>
                    <el-table v-if="reconcileRows.length" :data="reconcileRows" size="small">
                        <el-table-column prop="account" label="平台账户（旧）" min-width="240" />
                        <el-table-column label="账本中的新账户" min-width="280">
                            <template #default="{ row }">
                                <el-select v-model="reconcileTargets[row.account]" clearable filterable
                                    placeholder="选择账本中的新账户" style="width: 100%;">
                                    <el-option v-for="name in reconcileData.ledger_only" :key="name" :label="name"
                                        :value="name" />
                                </el-select>
                            </template>
                        </el-table-column>
                    </el-table>
                    <el-empty v-else description="没有需要配对的平台账户" :image-size="60" />

                    <h4>账本已关闭（平台仍有，可直接删除平台记录）</h4>
                    <div class="reconcile-ledger-only">
                        <el-tag v-for="name in reconcileData.ledger_closed" :key="name" type="info" size="small">
                            {{ name }}
                        </el-tag>
                        <span v-if="!reconcileData.ledger_closed.length" class="empty-hint">无</span>
                    </div>

                    <h4>账本有、平台无（新增候选）</h4>
                    <div class="reconcile-ledger-only">
                        <el-tag v-for="name in reconcileData.ledger_only" :key="name" type="success" size="small">
                            {{ name }}
                        </el-tag>
                        <span v-if="!reconcileData.ledger_only.length" class="empty-hint">无</span>
                    </div>
                </template>
            </div>
            <template #footer>
                <el-button @click="reconcileDialog = false">关闭</el-button>
                <el-button @click="fetchReconcile" :loading="reconcileLoading">重新检测</el-button>
                <el-button type="primary" :disabled="!hasReconcilePairs" :loading="reconcileApplying"
                    @click="applyReconcile">
                    应用配对
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Refresh, Search } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import { emitAccountTreeUpdated, emitTaskBannerRefresh } from '~/utils/accountEvents'
import type {
    CascaderOption,
    CascaderProps,
    CascaderValue,
    FormInstance,
    FormRules
} from 'element-plus'
import AnonymousPrompt from '../common/AnonymousPrompt.vue'
import RecurrenceRuleInput from '../recurrence/RecurrenceRuleInput.vue'
import { hasAuthTokens } from '../../utils/auth'
import { getAccountTypeColor } from '~/utils/accountTypeColor'
import { extractApiErrorMessage } from '../../utils/errorHelper'
import { shouldShowAnonymousPrompt } from '~/composables/useAnonymousPrompt'
import { groupAccountsByRoot, type AccountTreeNode } from '~/utils/accountTree'
import { getGitRepository } from '../../api/git'

// 接口定义
interface Account {
    id: number | string
    account: string
    parent?: number
    parent_account?: string
    account_type: string
    enable: boolean
    currency?: string
    created: string
    modified: string
    reconciliation_rule?: string | null
    description?: string
    children?: Account[]
    is_virtual?: boolean
    /** 账户由账本管理：路径、币种、删除需在账本处理（仅 Git 用户） */
    is_ledger_custodied?: boolean
    /** 账本中已 close：平台记录可直接清理 */
    is_ledger_closed?: boolean
    mapping_count?: {
        expense: number
        assets: number
        income: number
        total: number
    }
}

interface AccountMapping {
    id: number
    key: string
    enable: boolean
    payee?: string
    currency?: string
    payer?: string
}

interface AccountMappingsResponse {
    account: string
    account_id: number
    reconciliation_rule: string | null
    reconciliation_cycle_display: string
    expense_mappings: AccountMapping[]
    assets_mappings: AccountMapping[]
    income_mappings: AccountMapping[]
    total_count: number
}

type AccountOption = Omit<Account, 'children'> & CascaderOption & {
    children?: AccountOption[]
}

// 响应式数据
const loading = ref(false)
const accountTree = ref<AccountOption[]>([])
const selectedAccount = ref<AccountOption | null>(null)
const searchKeyword = ref('')
const accountTreeRef = ref<{
    setCurrentKey: (key: number | string | null) => void
    filter: (value: string) => void
    getNode: (key: number | string) => { expanded: boolean } | null
} | null>(null)
const accountTreeRenderKey = ref(0)

// 树形结构状态保持
const expandedKeys = ref<Array<number | string>>([])
const currentSelectedAccountId = ref<number | string | null>(null)

// 对话框状态
const addAccountDialog = ref(false)
const editAccountDialog = ref(false)
const deleteAccountDialog = ref(false)

// 匿名用户提示
const showAnonymousPrompt = ref(false)

// 是否启用 Git 同步（仅 Git 用户展示账户核对）
const gitEnabled = ref(false)
const checkGitEnabled = async () => {
    try {
        await getGitRepository()
        gitEnabled.value = true
    } catch {
        gitEnabled.value = false
    }
}

// 映射详情相关
const showMappingDetails = ref(false)
const mappingDetailsLoading = ref(false)
const accountMappings = ref<AccountMappingsResponse>({
    account: '',
    account_id: 0,
    reconciliation_rule: null,
    reconciliation_cycle_display: '未设置',
    expense_mappings: [],
    assets_mappings: [],
    income_mappings: [],
    total_count: 0
})
const activeMappingTab = ref('expense')

// 表单数据
const newAccount = ref({
    account: '',
    description: '',
    currency: '',
    reconciliation_rule: ''
})

const editAccountForm = ref({
    account: '',
    description: '',
    currency: '',
    reconciliation_rule: ''
})

// 仅资产 / 负债账户支持币种；常用币种作为下拉预设，允许自由输入
const CURRENCY_ACCOUNT_TYPES = ['Assets', 'Liabilities']
const COMMON_CURRENCIES = ['CNY', 'USD', 'COIN']
const splitCurrencies = (value?: string): string[] =>
    (value || '').split(',').map(item => item.trim()).filter(Boolean)

// 对账周期极简预设：点击即把 DSL 写入对账规则（均为后端解析器已验证可解析的规则）
const RECONCILIATION_CYCLE_PRESETS: Array<{ label: string; rule: string }> = [
    { label: '完成后一周', rule: 'every week when done' },
    { label: '每月', rule: 'every month' },
    { label: '月初', rule: 'every month on the 1st' },
    { label: '月底', rule: 'every month on the last' },
    { label: '年', rule: 'every year' }
]

// 删除账户相关
const migrationCandidates = ref<AccountOption[]>([])
const migrationCandidatesLoading = ref(false)
type MigrationModelValue = CascaderValue | CascaderValue[] | null
const selectedMigrationAccount = ref<MigrationModelValue>(null)
const selectedMigrationAccountInfo = ref<AccountOption | null>(null)
const deleteAccountLoading = ref(false)

// 账户核对（账本 → 平台）
interface AccountReconcileResult {
    ledger_available: boolean
    ledger_only: string[]
    db_only: string[]
    ledger_closed: string[]
    matched: string[]
}

const reconcileDialog = ref(false)
const reconcileLoading = ref(false)
const reconcileApplying = ref(false)
const reconcileData = ref<AccountReconcileResult>({
    ledger_available: false,
    ledger_only: [],
    db_only: [],
    ledger_closed: [],
    matched: []
})
const reconcileTargets = ref<Record<string, string>>({})
const reconcileRows = computed(() =>
    reconcileData.value.db_only.map(account => ({ account }))
)
const hasReconcilePairs = computed(() =>
    Object.values(reconcileTargets.value).some(Boolean)
)

const migrationCascaderValue = computed<CascaderValue | undefined>({
    get: () => selectedMigrationAccount.value === null ? undefined : selectedMigrationAccount.value as unknown as CascaderValue,
    set: (value: CascaderValue | null | undefined) => {
        selectedMigrationAccount.value = (value ?? null) as MigrationModelValue
    }
})

// 表单引用
const accountForm = ref<FormInstance>()
const editAccountFormRef = ref<FormInstance>()

// 树形组件配置
const treeProps = {
    children: 'children',
    label: 'account'
}

// 账户搜索：匹配路径或描述，并保留命中节点的祖先
const matchesAccountKeyword = (data: any, keyword: string): boolean => {
    const account = (data?.account || '').toLowerCase()
    const description = (data?.description || '').toLowerCase()
    return account.includes(keyword) || description.includes(keyword)
}

const filterAccountNode = (value: string, data: any): boolean => {
    const keyword = value.trim().toLowerCase()
    if (!keyword) return true
    if (matchesAccountKeyword(data, keyword)) return true
    return Boolean(data?.children?.some((child: any) => filterAccountNode(value, child)))
}

// 展开命中节点所在的父级，避免结果被折叠隐藏
const expandMatchedAncestors = (nodes: any[], keyword: string): void => {
    nodes.forEach((node: any) => {
        const children = node.children || []
        if (!children.length) return

        const hasMatchedChild = children.some((child: any) => filterAccountNode(keyword, child))
        if (!hasMatchedChild && !matchesAccountKeyword(node, keyword)) return

        const treeNode = accountTreeRef.value?.getNode(node.id)
        if (treeNode) treeNode.expanded = true
        expandMatchedAncestors(children, keyword)
    })
}

watch(searchKeyword, (value) => {
    accountTreeRef.value?.filter(value)
    const keyword = value.trim().toLowerCase()
    if (keyword) {
        expandMatchedAncestors(accountTree.value, keyword)
    }
})

// 级联选择器配置
const cascaderProps: CascaderProps = {
    value: 'id',
    label: 'account',
    children: 'children',
    emitPath: false,
    checkStrictly: true,
    expandTrigger: 'hover'
}

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

    // 返回匹配结果
    return lowerAccountName.includes(lowerKeyword) || lowerAccountType.includes(lowerKeyword)
}

const normalizeCascaderValue = (value: MigrationModelValue): number | null => {
    if (typeof value === 'number') return value
    if (Array.isArray(value)) {
        const last = value[value.length - 1]
        if (Array.isArray(last)) {
            const nested = last[last.length - 1]
            return typeof nested === 'number' ? nested : null
        }
        return typeof last === 'number' ? last : null
    }
    return null
}

const selectedMigrationAccountId = computed(() => normalizeCascaderValue(selectedMigrationAccount.value))

// 表单验证规则（新增 / 编辑分开：对账周期间隔只读当前表单，避免两套 model 共用规则时互相污染）
// 账户路径至少包含「根账户 + 一级子账户」，与 Beancount 规范一致
const ACCOUNT_PATH_PATTERN = /^[A-Z][A-Za-z0-9-]*(?::[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)+$/
const accountPathRules = [
    { required: true, message: '请输入账户路径', trigger: 'blur' },
    { pattern: ACCOUNT_PATH_PATTERN, message: '账户路径至少包含根账户和一级子账户，例如 Assets:Savings', trigger: 'blur' }
]

// 对账规则字段：仅做「填写了就不能是空白」的简单校验，DSL 语法由后端校验并返回 400
const reconciliationRuleField = {
    validator: (_rule: unknown, value: unknown, callback: (e?: Error) => void) => {
        if (typeof value === 'string' && value.length > 0 && value.trim() === '') {
            callback(new Error('对账规则不能为空'))
        } else {
            callback()
        }
    },
    trigger: 'change' as const
}

const addAccountRules: FormRules = {
    account: accountPathRules,
    reconciliation_rule: [reconciliationRuleField]
}

const editAccountRules: FormRules = {
    account: accountPathRules,
    reconciliation_rule: [reconciliationRuleField]
}


// 计算默认展开的节点
const calculateDefaultExpandedKeys = (accounts: AccountOption[], level: number = 1): Array<number | string> => {
    const expandedKeys: Array<number | string> = []

    accounts.forEach(account => {
        // 展示层的虚拟根节点默认展开，便于直接看到五类账户
        if (account.is_virtual) {
            expandedKeys.push(account.id)
            return
        }

        const accountType = account.account.split(':')[0]

        // 只展开Expenses类型的账户
        // if (accountType === 'Expenses' && level <= 2) {
        if (accountType === 'Expenses' && level <= 0) {
            expandedKeys.push(account.id)

            // 递归处理子账户
            if (account.children && account.children.length > 0) {
                const childKeys = calculateDefaultExpandedKeys(account.children, level + 1)
                expandedKeys.push(...childKeys)
            }
        }
    })

    return expandedKeys
}

// 计算属性
const hasMappings = computed(() => {
    return selectedAccount.value?.mapping_count && selectedAccount.value.mapping_count.total > 0
})

// 获取账户树形数据
const fetchAccountTree = async () => {
    try {
        loading.value = true

        // 保存当前状态
        const previousExpandedKeys = [...expandedKeys.value]
        const previousSelectedId = currentSelectedAccountId.value

        const response = await axios.get('/account/tree/')
        accountTree.value = groupAccountsByRoot(
            response.data as AccountTreeNode[]
        ) as unknown as AccountOption[]

        // default-expanded-keys 只在挂载时生效，刷新数据后重挂载以保留展开状态
        expandedKeys.value = previousExpandedKeys.length > 0
            ? previousExpandedKeys
            : calculateDefaultExpandedKeys(accountTree.value)
        accountTreeRenderKey.value += 1
        await nextTick()

        // 数据刷新后重新应用搜索过滤
        if (searchKeyword.value.trim()) {
            accountTreeRef.value?.filter(searchKeyword.value)
            expandMatchedAncestors(
                accountTree.value,
                searchKeyword.value.trim().toLowerCase()
            )
        }

        // 恢复选中的账户
        if (previousSelectedId) {
            const matchedAccount = findAccountById(accountTree.value, previousSelectedId)
            if (matchedAccount) {
                selectedAccount.value = matchedAccount
                currentSelectedAccountId.value = previousSelectedId
                accountTreeRef.value?.setCurrentKey(previousSelectedId)
                // 重新获取映射数据
                await fetchAccountMappings()
            }
        }
    } catch (error: any) {
        console.error('获取账户树失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error('获取账户数据失败')
        }
    } finally {
        loading.value = false
    }
}

// 节点点击处理
const handleNodeClick = async (data: AccountOption, node?: { expanded: boolean }) => {
    // 虚拟根节点只负责展开/收起，不作为可编辑账户
    if (data.is_virtual) {
        if (node) node.expanded = !node.expanded
        return
    }

    selectedAccount.value = data
    currentSelectedAccountId.value = data.id
    // 重置映射详情状态
    showMappingDetails.value = false

    // 自动获取映射数据
    await fetchAccountMappings()
}

// 节点展开处理
const handleNodeExpand = (data: AccountOption) => {
    if (!expandedKeys.value.includes(data.id)) {
        expandedKeys.value.push(data.id)
    }
}

// 节点折叠处理
const handleNodeCollapse = (data: AccountOption) => {
    const index = expandedKeys.value.indexOf(data.id)
    if (index > -1) {
        expandedKeys.value.splice(index, 1)
    }
}

// 更新账户状态
const updateAccountStatus = async (account: AccountOption) => {
    try {
        await axios.patch(`/account/${account.id}/`, {
            enable: account.enable
        })
        ElMessage.success('账户状态更新成功')
        emitAccountTreeUpdated()
        // 账户状态变更后，触发横幅刷新
        emitTaskBannerRefresh()
    } catch (error: any) {
        // 回滚状态
        account.enable = !account.enable
        console.error('更新账户状态失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '更新账户状态失败'))
        }
    }
}

// 显示新增账户对话框
const showAddAccountDialog = () => {
    newAccount.value = {
        account: '',
        description: '',
        currency: '',
        reconciliation_rule: ''
    }
    addAccountDialog.value = true
}

// 创建账户
const createAccount = async () => {
    if (!accountForm.value) return

    try {
        await accountForm.value.validate()
        // 非资产 / 负债账户不提交币种（避免切换路径后残留旧值）
        const createRoot = newAccount.value.account.trim().split(':')[0]
        const payload = {
            ...newAccount.value,
            currency: CURRENCY_ACCOUNT_TYPES.includes(createRoot)
                ? newAccount.value.currency
                : ''
        }
        const response = await axios.post('/account/', payload)
        if (response.data?.ledger_sync_warning) {
            ElMessage.warning(response.data.ledger_sync_warning)
        }
        ElMessage.success('账户创建成功')
        addAccountDialog.value = false
        await fetchAccountTree()
        emitAccountTreeUpdated()

        // 如果创建账户时设置了对账规则，触发横幅刷新
        if (newAccount.value.reconciliation_rule) {
            emitTaskBannerRefresh()
        }
    } catch (error: any) {
        console.error('创建账户失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else if (error.response?.status === 400) {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '创建失败，请检查账户路径、币种或对账规则'))
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '创建账户失败'))
        }
    }
}

// 编辑账户
const editAccount = () => {
    if (!selectedAccount.value) return

    editAccountForm.value = {
        account: selectedAccount.value.account,
        description: selectedAccount.value.description || '',
        currency: selectedAccount.value.currency || '',
        reconciliation_rule: selectedAccount.value.reconciliation_rule || ''
    }
    editAccountDialog.value = true
}

// 更新账户
const updateAccount = async () => {
    if (!editAccountFormRef.value || !selectedAccount.value) return

    try {
        await editAccountFormRef.value.validate()

        // 构建更新数据
        const updateData: {
            account: string
            description?: string
            currency?: string
            reconciliation_rule?: string
        } = {
            account: editAccountForm.value.account,
            description: editAccountForm.value.description || ''
        }

        // 仅资产 / 负债账户保留币种；改为其它类型时清空
        const finalRoot = editAccountForm.value.account.split(':')[0]
        updateData.currency = CURRENCY_ACCOUNT_TYPES.includes(finalRoot)
            ? editAccountForm.value.currency
            : ''

        // 如果账户应该显示对账周期，则包含对账规则；否则清除该字段
        const shouldShow = shouldShowReconciliationCycle(selectedAccount.value)
        if (shouldShow) {
            updateData.reconciliation_rule = editAccountForm.value.reconciliation_rule || ''
        } else {
            updateData.reconciliation_rule = ''
        }

        // 检查对账周期配置是否发生变化
        const oldRule = selectedAccount.value.reconciliation_rule || ''
        const newRule = updateData.reconciliation_rule
        // 开启对账周期（从无到有）或删除对账周期（从有到无）时，待办任务会变化，需要刷新横幅
        const cycleConfigChanged = (!!oldRule && !newRule) || (!oldRule && !!newRule)

        const response = await axios.put(`/account/${selectedAccount.value.id}/`, updateData)
        if (response.data?.ledger_sync_warning) {
            ElMessage.warning(response.data.ledger_sync_warning)
        }
        ElMessage.success('账户更新成功')
        editAccountDialog.value = false

        const pathChanged = selectedAccount.value.account !== updateData.account
        if (pathChanged) {
            await fetchAccountTree()
        } else {
            selectedAccount.value.description = updateData.description
            selectedAccount.value.currency = updateData.currency || ''
            selectedAccount.value.reconciliation_rule = updateData.reconciliation_rule ?? null
            // 同步刷新映射详情（其 reconciliation_cycle_display 由对账规则派生）
            await fetchAccountMappings()
        }
        emitAccountTreeUpdated()

        // 如果对账周期配置发生变化（开启或删除），触发横幅刷新
        if (cycleConfigChanged) {
            emitTaskBannerRefresh()
        }
    } catch (error: any) {
        console.error('更新账户失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else if (error.response?.status === 400) {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '更新失败，请检查账户路径、币种或对账规则'))
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '更新账户失败'))
        }
    }
}

// 删除账户
const deleteAccount = async () => {
    if (!selectedAccount.value) return

    // 重置迁移选择
    selectedMigrationAccount.value = null
    selectedMigrationAccountInfo.value = null
    migrationCandidates.value = []

    // 获取迁移候选账户
    await fetchMigrationCandidates()

    deleteAccountDialog.value = true
}

// 获取迁移候选账户
const fetchMigrationCandidates = async () => {
    if (!selectedAccount.value) return

    try {
        migrationCandidatesLoading.value = true
        const response = await axios.get(`/account/${selectedAccount.value.id}/migration_candidates/`)

        // 将候选账户转换为树形结构
        migrationCandidates.value = buildAccountTree(response.data.candidates)
    } catch (error: any) {
        console.error('获取迁移候选账户失败:', error)
        ElMessage.error('获取迁移候选账户失败')
        migrationCandidates.value = []
    } finally {
        migrationCandidatesLoading.value = false
    }
}

// 获取账户核对候选
const fetchReconcile = async () => {
    try {
        reconcileLoading.value = true
        const response = await axios.get<AccountReconcileResult>('/account/reconcile/')
        reconcileData.value = response.data

        // 清理已不存在的配对
        const validAccounts = new Set(response.data.db_only)
        Object.keys(reconcileTargets.value).forEach((account) => {
            if (!validAccounts.has(account)) {
                delete reconcileTargets.value[account]
            }
        })
    } catch (error: any) {
        console.error('获取账户核对数据失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '获取账户核对数据失败'))
        }
    } finally {
        reconcileLoading.value = false
    }
}

const openReconcileDialog = async () => {
    reconcileDialog.value = true
    reconcileTargets.value = {}
    await fetchReconcile()
}

// 应用用户确认的旧 → 新配对
const applyReconcile = async () => {
    const pairs = Object.entries(reconcileTargets.value)
        .filter(([, newAccount]) => Boolean(newAccount))
        .map(([oldAccount, newAccount]) => ({
            old_account: oldAccount,
            new_account: newAccount
        }))

    if (pairs.length === 0) {
        ElMessage.warning('请先为需要改名的账户选择账本中的新账户')
        return
    }

    try {
        reconcileApplying.value = true
        await axios.post('/account/reconcile/apply/', { pairs })
        ElMessage.success('账户核对已应用')
        reconcileTargets.value = {}
        await fetchAccountTree()
        emitAccountTreeUpdated()
        await fetchReconcile()
    } catch (error: any) {
        console.error('应用账户核对失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '应用账户核对失败'))
        }
    } finally {
        reconcileApplying.value = false
    }
}

// 构建账户树形结构
const buildAccountTree = (accounts: Account[]): AccountOption[] => {
    const accountMap = new Map<number | string, AccountOption>()
    const rootAccounts: AccountOption[] = []

    accounts.forEach(account => {
        accountMap.set(account.id, { ...account, children: [] })
    })

    accounts.forEach(account => {
        const accountNode = accountMap.get(account.id)
        if (!accountNode) return

        if (account.parent && accountMap.has(account.parent)) {
            const parentNode = accountMap.get(account.parent)
            if (parentNode) {
                if (!parentNode.children) parentNode.children = []
                parentNode.children.push(accountNode)
            }
        } else {
            rootAccounts.push(accountNode)
        }
    })

    return rootAccounts
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

// 处理迁移账户选择变化
const handleMigrationAccountChange = (value: CascaderValue | null | undefined) => {
    const normalizedValue = normalizeCascaderValue(value ?? null)
    if (normalizedValue !== null) {
        const account = findAccountById(migrationCandidates.value, normalizedValue)
        selectedMigrationAccountInfo.value = account
    } else {
        selectedMigrationAccountInfo.value = null
    }
}

// 处理迁移账户下拉框显示状态
const handleMigrationVisibleChange = (visible: boolean) => {
    if (visible && migrationCandidates.value.length === 0) {
        fetchMigrationCandidates()
    }
}

// 确认删除账户
const confirmDeleteAccount = async () => {
    if (!selectedAccount.value) return

    // 如果有映射但没有选择迁移目标，则不允许删除
    if (hasMappings.value && selectedMigrationAccountId.value === null) {
        ElMessage.warning('请选择迁移目标账户')
        return
    }

    try {
        deleteAccountLoading.value = true

        // 构建删除请求数据
        const deleteData: Record<string, unknown> = {}
        if (hasMappings.value && selectedMigrationAccountId.value !== null) {
            deleteData.migrate_to = selectedMigrationAccountId.value
        }

        await axios.delete(`/account/${selectedAccount.value.id}/`, {
            data: deleteData
        })

        ElMessage.success('账户删除成功')
        deleteAccountDialog.value = false
        selectedAccount.value = null
        currentSelectedAccountId.value = null
        await fetchAccountTree()
        emitAccountTreeUpdated()
        // 账户删除后，触发横幅刷新
        emitTaskBannerRefresh()
    } catch (error: any) {
        console.error('删除账户失败:', error)
        if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else if (error.response?.status === 400) {
            const errorMsg = error.response.data?.error || '删除失败，请检查数据'
            ElMessage.error(errorMsg)
        } else {
            ElMessage.error(error.response?.data?.error || '删除账户失败')
        }
    } finally {
        deleteAccountLoading.value = false
    }
}

// 格式化日期时间
const formatDateTime = (dateString: string): string => {
    if (!dateString) return ''

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''

    const pad = (num: number) => num.toString().padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// 判断是否应该显示对账周期字段
// 判断账户是否显示币种（仅资产 / 负债）
const shouldShowCurrency = (account: AccountOption | null): boolean => {
    if (!account) return false
    return CURRENCY_ACCOUNT_TYPES.includes(account.account.split(':')[0])
}

// 判断新增账户时是否显示币种设置
const shouldShowCurrencyForNewAccount = (): boolean => {
    const accountPath = newAccount.value.account.trim()
    if (!accountPath) return true
    return CURRENCY_ACCOUNT_TYPES.includes(accountPath.split(':')[0])
}

const shouldShowReconciliationCycle = (account: AccountOption | null): boolean => {
    if (!account) return false

    // 如果账户有子账户，不显示
    if (account.children && account.children.length > 0) {
        return false
    }

    // 从账户路径获取账户类型（第一个部分）
    const accountType = account.account.split(':')[0]

    // 权益账户、支出账户、收入账户不显示对账周期
    const hiddenTypes = ['Equity', 'Expenses', 'Income']
    if (hiddenTypes.includes(accountType)) {
        return false
    }

    return true
}

// 判断新增账户时是否应该显示对账周期设置
const shouldShowReconciliationCycleForNewAccount = (): boolean => {
    const accountPath = newAccount.value.account.trim()
    if (!accountPath) return true // 如果还没有输入账户路径，默认显示

    // 从账户路径获取账户类型（第一个部分）
    const accountType = accountPath.split(':')[0]

    // 权益账户、支出账户、收入账户不显示对账周期
    const hiddenTypes = ['Equity', 'Expenses', 'Income']
    if (hiddenTypes.includes(accountType)) {
        return false
    }

    return true
}

// 切换映射详情显示
const toggleMappingDetails = () => {
    showMappingDetails.value = !showMappingDetails.value
}

// 获取账户映射详情
const fetchAccountMappings = async () => {
    if (!selectedAccount.value) return

    try {
        mappingDetailsLoading.value = true
        const response = await axios.get<AccountMappingsResponse>(`/account/${selectedAccount.value.id}/mappings/`)
        accountMappings.value = response.data

        // 同步对账规则到 selectedAccount
        if (selectedAccount.value) {
            selectedAccount.value.reconciliation_rule = response.data.reconciliation_rule
        }

        // 设置默认激活的标签页
        if (response.data.expense_mappings && response.data.expense_mappings.length > 0) {
            activeMappingTab.value = 'expense'
        } else if (response.data.assets_mappings && response.data.assets_mappings.length > 0) {
            activeMappingTab.value = 'assets'
        } else if (response.data.income_mappings && response.data.income_mappings.length > 0) {
            activeMappingTab.value = 'income'
        }
    } catch (error: unknown) {
        console.error('获取映射详情失败:', error)
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number, data?: { message?: string } } }
            if (axiosError.response?.status === 401) {
                ElMessage.info('未认证，请登录后重试')
            } else {
                ElMessage.error(axiosError.response?.data?.message || '获取映射详情失败')
            }
        } else {
            ElMessage.error('获取映射详情失败')
        }
    } finally {
        mappingDetailsLoading.value = false
    }
}

// 获取支出映射悬浮提示内容
const getExpenseMappingTooltip = () => {
    if (!accountMappings.value.expense_mappings || accountMappings.value.expense_mappings.length === 0) {
        return '暂无支出映射'
    }
    return accountMappings.value.expense_mappings
        .map((m: AccountMapping) => `${m.key} → ${selectedAccount.value?.account || '未知账户'}`)
        .join('\n')
}

// 获取资产映射悬浮提示内容
const getAssetsMappingTooltip = () => {
    if (!accountMappings.value.assets_mappings || accountMappings.value.assets_mappings.length === 0) {
        return '暂无资产映射'
    }
    return accountMappings.value.assets_mappings
        .map((m: AccountMapping) => `${m.key} → ${selectedAccount.value?.account || '未知账户'}`)
        .join('\n')
}

// 获取收入映射悬浮提示内容
const getIncomeMappingTooltip = () => {
    if (!accountMappings.value.income_mappings || accountMappings.value.income_mappings.length === 0) {
        return '暂无收入映射'
    }
    return accountMappings.value.income_mappings
        .map((m: AccountMapping) => `${m.key} → ${selectedAccount.value?.account || '未知账户'}`)
        .join('\n')
}

// 处理匿名用户跳过提示
const handleSkipAnonymous = () => {
    showAnonymousPrompt.value = false
    // 继续加载数据，显示admin用户的共享配置
    fetchAccountTree()
}

// 组件挂载时初始化数据
onMounted(() => {
    // 检查用户是否已登录
    const isAuthenticated = hasAuthTokens()

    if (isAuthenticated) {
        // 已登录用户直接加载数据
        checkGitEnabled()
        fetchAccountTree()
    } else {
        // 未登录用户：检查是否应该显示提示（仅显示一次）
        if (shouldShowAnonymousPrompt(false)) {
            showAnonymousPrompt.value = true
        } else {
            // 如果用户已经看过提示，直接加载数据，显示admin用户的共享配置
            fetchAccountTree()
        }
    }
})
</script>

<style scoped>
.account-management {
    padding: 20px;
    background-color: var(--ep-bg-color);
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
    border-bottom: 1px solid var(--ep-border-color);
}

.management-header h2 {
    margin: 0;
    color: var(--ep-text-color-primary);
    font-size: 24px;
    font-weight: 600;
}

.header-actions {
    display: flex;
    gap: 10px;
}

.management-content {
    display: flex;
    gap: 20px;
    min-height: 600px;
}

.account-tree-panel {
    flex: 0 0 400px;
    border: 1px solid var(--ep-border-color);
    border-radius: 8px;
    padding: 15px;
    background-color: var(--ep-fill-color-light);
}

.account-search {
    margin-bottom: 12px;
}

.account-tree {
    background-color: transparent;
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
    color: var(--ep-text-color-primary);
}

.node-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.account-detail-panel {
    flex: 1;
    border: 1px solid var(--ep-border-color);
    border-radius: 8px;
    padding: 20px;
    background-color: var(--ep-bg-color);
}

.account-title {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--ep-color-primary);
}

.account-detail h3 {
    margin: 0;
    color: var(--ep-text-color-primary);
    font-size: 20px;
    font-weight: 600;
}

.info-card,
.currency-card {
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

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.currency-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 40px;
    align-items: center;
}

.currency-tag {
    margin: 0;
}

.action-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--ep-border-color);
}

/* 对账周期极简预设 */
.cycle-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.cycle-presets .preset-btn {
    margin: 0;
}

.currency-management {
    padding: 10px 0;
}

.available-currencies h4 {
    margin: 0 0 15px 0;
    color: var(--ep-text-color-regular);
    font-size: 16px;
}

/* 映射统计样式 */
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

.mapping-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    background-color: var(--ep-fill-color-light);
    border-radius: 6px;
    border: 1px solid var(--ep-border-color);
    transition: all 0.2s ease;
}

.mapping-item:hover {
    background-color: var(--ep-fill-color);
    border-color: var(--ep-border-color);
}

.mapping-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
}

.mapping-key {
    font-weight: 500;
    color: var(--ep-text-color-primary);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background-color: var(--ep-fill-color-lighter);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
}

.mapping-payee,
.mapping-full,
.mapping-payer,
.mapping-account {
    color: var(--ep-text-color-regular);
    font-size: 14px;
}

.mapping-account {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background-color: var(--ep-color-primary-light-9);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--ep-color-primary);
}

.mapping-currency {
    color: var(--ep-text-color-secondary);
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

    .account-tree-panel {
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

/* 删除账户对话框样式 */
.delete-account-content {
    padding: 10px 0;
}

.migration-section {
    margin-top: 20px;
    padding: 20px;
    background-color: var(--ep-fill-color-light);
    border-radius: 8px;
    border: 1px solid var(--ep-border-color);
}

.migration-section h4 {
    margin: 0 0 10px 0;
    color: var(--ep-text-color-primary);
    font-size: 16px;
    font-weight: 600;
}

.migration-tip {
    margin: 0 0 15px 0;
    color: var(--ep-text-color-regular);
    font-size: 14px;
}

.no-candidates {
    margin-top: 15px;
}

.no-mappings-section {
    margin-top: 20px;
    padding: 20px;
    background-color: var(--ep-color-primary-light-9);
    border-radius: 8px;
    border: 1px solid var(--ep-color-primary-light-7);
}

/* AccountSelector 样式 */
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

/* AccountSelector 中的 node-label 样式 */
.account-selector .node-label {
    flex: 1;
    font-weight: 500;
}

.node-tag,
.mapping-tag {
    margin: 0;
}

.account-preview {
    margin-top: 12px;
}

.preview-content {
    padding: 8px;
}

.account-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
}

.account-info h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ep-text-color-primary);
}

.currencies,
.mapping-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.label {
    font-size: 12px;
    color: var(--ep-text-color-secondary);
    min-width: 60px;
}

.currency-tag {
    margin: 0;
}

/* 账户核对 */
.reconcile-content h4 {
    margin: 18px 0 10px;
    color: var(--ep-text-color-primary);
    font-size: 14px;
    font-weight: 600;
}

.reconcile-ledger-only {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 24px;
}

.reconcile-ledger-only .empty-hint {
    color: var(--ep-text-color-secondary);
    font-size: 13px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .account-info {
        flex-direction: column;
        align-items: flex-start;
    }

    .currencies,
    .mapping-stats {
        flex-wrap: wrap;
    }
}
</style>
