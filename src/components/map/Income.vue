<template>
    <div class="income-mapping">
        <!-- 搜索和操作栏 -->
        <div class="toolbar">
            <div class="search-section">
                <el-input v-model="search" placeholder="搜索关键字、账户、标签" clearable @input="handleSearch">
                    <template #prefix>
                        <el-icon>
                            <Search />
                        </el-icon>
                    </template>
                </el-input>
                <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px;"
                    @change="handleSearch" @clear="statusFilter = 'all'; handleSearch()">
                    <el-option label="全部" :value="'all'" />
                    <el-option label="已启用" :value="true" />
                    <el-option label="已禁用" :value="false" />
                </el-select>
            </div>
            <div class="action-section">
                <el-button type="primary" @click="handleAdd()">
                    <el-icon>
                        <Plus />
                    </el-icon>
                    新增映射
                </el-button>
                <el-button @click="handleImport()">
                    <el-icon>
                        <Upload />
                    </el-icon>
                    导入
                </el-button>
                <el-button @click="handleExport()">
                    <el-icon>
                        <Download />
                    </el-icon>
                    导出
                </el-button>
            </div>
        </div>

        <!-- 映射列表 -->
        <el-table :data="filterIncomeData" v-loading="loading" style="width: 100%;"
            @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="55" />

            <el-table-column label="关键字" prop="key" sortable :sort-method="advancedSort" min-width="100" width="auto">
                <template #default="{ row }">
                    <el-tag type="primary" size="small">{{ row.key }}</el-tag>
                </template>
            </el-table-column>
            <!-- 
            <el-table-column label="付款方" prop="payer" width="150">
                <template #default="{ row }">
                    <span v-if="row.payer">{{ row.payer }}</span>
                    <el-text v-else type="info" size="small">-</el-text>
                </template>
            </el-table-column> -->

            <el-table-column label="映射账户" prop="income" sortable :sort-method="sortByAccount" min-width="180"
                width="auto">
                <template #default="{ row }">
                    <div class="account-cell">
                        <el-text type="primary">{{ typeof row.income === 'object' ? row.income?.account : row.income
                            }}</el-text>
                        <el-tag v-if="typeof row.income === 'object' && row.income?.account_type"
                            :type="getAccountTypeColor(row.income.account_type)" size="small">
                            {{ row.income.account_type }}
                        </el-tag>
                    </div>
                </template>
            </el-table-column>

            <!-- <el-table-column label="关联货币" prop="currencies" width="150">
                <template #default="{ row }">
                    <div v-if="row.currencies && row.currencies.length > 0" class="currency-cell">
                        <el-tag v-for="currency in row.currencies" :key="currency.id" size="small" class="currency-tag">
                            {{ currency.code }}
                        </el-tag>
                    </div>
                    <el-text v-else type="info" size="small">CNY</el-text>
                </template>
            </el-table-column> -->

            <el-table-column label="标签" min-width="180" width="auto">
                <template #default="{ row }">
                    <div v-if="row.tags && row.tags.length > 0" class="tags-cell">
                        <el-tag v-for="tag in row.tags" :key="tag.id" size="small"
                            :type="tag.enable !== false ? undefined : 'info'"
                            style="margin-right: 4px; margin-bottom: 4px;">
                            {{ tag.full_path }}
                        </el-tag>
                    </div>
                    <el-text v-else type="info" size="small">-</el-text>
                </template>
            </el-table-column>

            <el-table-column label="状态" prop="enable" width="100">
                <template #default="{ row }">
                    <el-switch v-model="row.enable" @change="handleSwitchChange(row)" inline-prompt active-text="启用"
                        inactive-text="禁用" />
                </template>
            </el-table-column>

            <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row, $index }">
                    <el-button size="small" @click="handleEdit($index, row)">
                        <el-icon>
                            <Edit />
                        </el-icon>
                    </el-button>
                    <el-button size="small" type="danger" @click="handleDelete($index, row)">
                        <el-icon>
                            <Delete />
                        </el-icon>
                    </el-button>
                </template>
            </el-table-column>
        </el-table>

        <!-- 批量操作栏 -->
        <div v-if="selectedItems.length > 0" class="batch-actions">
            <el-alert :title="`已选择 ${selectedItems.length} 项`" type="info" show-icon :closable="false">
                <template #default>
                    <div class="batch-buttons">
                        <el-button size="small" @click="handleBatchEnable">批量启用</el-button>
                        <el-button size="small" @click="handleBatchDisable">批量禁用</el-button>
                        <el-button size="small" type="primary" @click="handleBatchUpdateAccount">批量修改账户</el-button>
                        <el-button size="small" type="danger" @click="handleBatchDelete">批量删除</el-button>
                    </div>
                </template>
            </el-alert>
        </div>
    </div>
    <!-- 新增映射对话框 -->
    <el-dialog v-model="dialogAdd" title="新增收入映射" width="600px">
        <el-form ref="ruleFormRef" :model="ruleForm" :rules="rules" label-width="100px" status-icon>
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="关键字" prop="key">
                        <el-input v-model="ruleForm.key" placeholder="红包" />
                    </el-form-item>
                </el-col>
                <!-- <el-col :span="12">
                    <el-form-item label="付款方" prop="payer">
                        <el-input v-model="ruleForm.payer" placeholder="微信（可选）" />
                    </el-form-item>
                </el-col> -->
            </el-row>

            <el-form-item label="映射账户" prop="income">
                <AccountSelector v-model="ruleForm.income" placeholder="请选择或搜索账户" @change="handleAccountChange" />
            </el-form-item>

            <!-- <el-form-item label="关联货币" prop="currency_ids">
                <CurrencySelector v-model="ruleForm.currency_ids" :account-id="ruleForm.income" placeholder="选择货币" />
            </el-form-item> -->

            <el-form-item label="关联标签" prop="tag_ids">
                <TagSelector v-model="ruleForm.tag_ids" multiple :show-preview="false" placeholder="请选择标签（可多选）" />
            </el-form-item>

            <el-form-item>
                <el-button type="primary" @click="submitForm(ruleFormRef)">新增</el-button>
            </el-form-item>
        </el-form>
    </el-dialog>
    <!-- 编辑映射对话框 -->
    <el-dialog v-model="dialogEdit" width="600px">
        <el-form ref="editFormRef" :model="ruleForm" :rules="rules" label-width="100px" status-icon>
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="关键字" prop="key">
                        <el-input v-model="ruleForm.key" />
                    </el-form-item>
                </el-col>
                <!-- <el-col :span="12">
                    <el-form-item label="付款方" prop="payer">
                        <el-input v-model="ruleForm.payer" />
                    </el-form-item>
                </el-col> -->
            </el-row>

            <el-form-item label="映射账户" prop="income">
                <AccountSelector v-model="ruleForm.income" placeholder="请选择或搜索账户" @change="handleAccountChange" />
            </el-form-item>

            <!-- <el-form-item label="关联货币" prop="currency_id">
                <CurrencySelector v-model="ruleForm.currency_id" :account-id="ruleForm.income || undefined"
                    placeholder="选择货币" />
            </el-form-item> -->

            <el-form-item label="关联标签" prop="tag_ids">
                <TagSelector v-model="ruleForm.tag_ids" :known-tags="editKnownTags" multiple :show-preview="false"
                    placeholder="请选择标签（可多选）" />
            </el-form-item>

            <el-form-item>
                <el-button type="primary" @click="editForm(editFormRef)">保存</el-button>
                <el-button @click="dialogEdit = false">取消</el-button>
            </el-form-item>
        </el-form>
    </el-dialog>

    <el-dialog v-model="dialogDel" title="提示" width="30%">
        <el-icon>
            <WarningFilled />
        </el-icon><span>此操作将永久删除该条目, 是否继续?</span>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="dialogDel = false">取消</el-button>
                <el-button type="primary" @click="confirmDelete">确定</el-button>
            </span>
        </template>
    </el-dialog>
    <!-- 批量删除确认对话框 -->
    <el-dialog v-model="batchDeleteDialog" title="批量删除收入映射" width="600px" :close-on-click-modal="false">
        <div class="batch-delete-content">
            <!-- 警告信息 -->
            <el-alert title="删除确认" type="warning" :closable="false" show-icon style="margin-bottom: 20px;">
                <template #default>
                    <p>您即将删除 <strong>{{ selectedItems.length }}</strong> 个收入映射，此操作不可撤销！</p>
                    <p>请仔细确认以下映射信息：</p>
                </template>
            </el-alert>

            <!-- 删除项目列表 -->
            <div class="delete-items-list">
                <div v-for="(item, index) in selectedItems" :key="item.id" class="delete-item">
                    <div class="item-info">
                        <div class="item-main">
                            <el-tag type="primary" size="small">{{ item.key }}</el-tag>
                            <span v-if="item.payer" class="item-payer">{{ item.payer }}</span>
                        </div>
                        <div class="item-account">
                            {{ typeof item.income === 'object' ? item.income?.account : item.income }}
                        </div>
                    </div>
                    <div class="item-index">{{ index + 1 }}</div>
                </div>
            </div>

            <!-- 进度条 -->
            <div v-if="batchDeleteLoading" class="delete-progress">
                <el-progress :percentage="batchDeleteProgress"
                    :status="batchDeleteProgress === 100 ? 'success' : undefined" :stroke-width="8" />
                <p class="progress-text">正在删除映射... {{ batchDeleteProgress }}%</p>
            </div>

            <!-- 错误信息 -->
            <div v-if="batchDeleteErrors.length > 0" class="delete-errors">
                <el-alert title="部分删除失败" type="error" :closable="false" show-icon>
                    <template #default>
                        <ul class="error-list">
                            <li v-for="error in batchDeleteErrors" :key="error" class="error-item">
                                {{ error }}
                            </li>
                        </ul>
                    </template>
                </el-alert>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button @click="cancelBatchDelete" :disabled="batchDeleteLoading">
                    取消
                </el-button>
                <el-button type="danger" @click="confirmBatchDelete" :loading="batchDeleteLoading"
                    :disabled="batchDeleteLoading">
                    {{ batchDeleteLoading ? '删除中...' : '确认删除' }}
                </el-button>
            </div>
        </template>
    </el-dialog>

    <!-- 批量修改账户对话框 -->
    <el-dialog v-model="batchUpdateAccountDialog" title="批量修改收入映射账户" width="600px" :close-on-click-modal="false">
        <div class="batch-update-content">
            <el-alert :title="`您即将修改 ${selectedItems.length} 个收入映射的映射账户`" type="info" :closable="false" show-icon
                style="margin-bottom: 20px;">
            </el-alert>

            <div class="delete-items-list">
                <div v-for="(item, index) in selectedItems" :key="item.id" class="delete-item">
                    <div class="item-info">
                        <div class="item-main">
                            <el-tag type="primary" size="small">{{ item.key }}</el-tag>
                            <span v-if="item.payer" class="item-payer">{{ item.payer }}</span>
                        </div>
                        <div class="item-account">
                            {{ typeof item.income === 'object' ? item.income?.account : item.income }}
                        </div>
                    </div>
                    <div class="item-index">{{ index + 1 }}</div>
                </div>
            </div>

            <el-form ref="batchUpdateFormRef" :model="batchUpdateForm" label-width="100px" status-icon>
                <el-form-item label="映射账户">
                    <AccountSelector v-model="batchUpdateForm.income" placeholder="请选择目标映射账户"
                        @change="handleBatchAccountChange" />
                </el-form-item>
            </el-form>

            <div v-if="batchUpdateLoading" class="update-progress">
                <el-progress :percentage="batchUpdateProgress"
                    :status="batchUpdateProgress === 100 ? 'success' : undefined" :stroke-width="8" />
                <p class="progress-text">正在更新映射... {{ batchUpdateProgress }}%</p>
            </div>

            <div v-if="batchUpdateErrors.length > 0" class="update-errors">
                <el-alert title="部分更新失败" type="error" :closable="false" show-icon>
                    <template #default>
                        <ul class="error-list">
                            <li v-for="error in batchUpdateErrors" :key="error" class="error-item">
                                {{ error }}
                            </li>
                        </ul>
                    </template>
                </el-alert>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <el-button @click="cancelBatchUpdateAccount" :disabled="batchUpdateLoading">
                    取消
                </el-button>
                <el-button type="primary" @click="confirmBatchUpdateAccount" :loading="batchUpdateLoading"
                    :disabled="batchUpdateLoading || !batchUpdateForm.income">
                    {{ batchUpdateLoading ? '更新中...' : '确认更新' }}
                </el-button>
            </div>
        </template>
    </el-dialog>

    <!-- <el-dialog v-model="dialogError" title="操作失败" width="30%">
        <el-icon>
            <WarningFilled />
        </el-icon><span>>新增/修改/删除 失败，请登录后重试</span>
    </el-dialog> -->
</template>

<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, ref, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { Search, Plus, Upload, Download, Edit, Delete } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import handleRefresh from '../../utils/commonFunctions'
import { extractApiErrorMessage } from '../../utils/errorHelper'
import * as XLSX from 'xlsx'
import { pinyin } from 'pinyin-pro';
import AccountSelector from '../common/AccountSelector.vue'
import TagSelector from '../common/TagSelector.vue'
// import CurrencySelector from '../common/CurrencySelector.vue'
import { getAccountTypeColor } from '~/utils/accountTypeColor'


const dialogError = ref(false)
const loading = ref(false)

// interface Currency {
//     id: number
//     code: string
//     name: string
// }

interface Income {
    id: number
    key: string
    payer: string | null | undefined
    income: string | { id: number; account: string; enable: boolean; account_type?: string }
    income_id?: number
    // currencies: Currency[]
    // currency_ids?: number[]
    account_type?: string
    enable: boolean
    tags?: Array<{
        id: number
        name: string
        full_path: string
        enable: boolean
    }>
}

// 页面增加优先级提示
const showTooltip = ref(true)
const incometipContent = ref("固定格式： [银行]+[储蓄卡/信用卡]+([卡号])。用于支付宝还款功能映射 and 支付宝提现至储蓄卡");

// 页面获取数据
const IncomeData = ref<Income[]>([])
const selectedItems = ref<Income[]>([])

// 过滤器状态
const statusFilter = ref<'all' | boolean>('all')

const fetchData = async () => {
    try {
        loading.value = true
        const response = await axios.get('income/')
        IncomeData.value = response.data.sort((a: any, b: any) => a.id - b.id)
    } catch (error: any) {
        console.error(error)
        if (error.response?.data?.code == "token_not_valid") {
            handleRefresh();
        } else if (error.response?.status === 401) {
            ElMessage.info('未认证，请登录后重试')
        } else {
            ElMessage.error('获取收入映射数据失败')
        }
    } finally {
        loading.value = false
    }
}


// 页面数据获取(组件挂载)
onMounted(() => {
    fetchData()
})

// 暴露方法给父组件调用
defineExpose({
    fetchData
})

// 关键字搜索
const search = ref('')

const filterIncomeData = computed(() =>
    IncomeData.value.filter((data) => {
        // 搜索词过滤
        const searchTerm = search.value?.toLowerCase() || ''
        if (searchTerm) {
            const incomeAccount = typeof data.income === 'string' ? data.income.toLowerCase() : data.income?.account?.toLowerCase() ?? ''

            // 标签搜索
            const tagNames = data.tags?.map(tag => tag.full_path.toLowerCase()).join(' ') || ''

            const matchesSearch = [
                data.key.toLowerCase(),
                data.payer?.toLowerCase() ?? '',
                incomeAccount,
                tagNames
            ].some(field => field.includes(searchTerm))

            if (!matchesSearch) return false
        }

        // 状态过滤
        if (statusFilter.value !== 'all' && data.enable !== statusFilter.value) {
            return false
        }

        return true
    })
)

// 搜索处理
const handleSearch = () => {
    // 搜索逻辑已在计算属性中处理
}

// 新增
const dialogAdd = ref(false)
const editKnownTags = ref<Income['tags']>([])

const handleAdd = () => {
    editKnownTags.value = []
    ruleForm.value = {
        key: '',
        payer: null,
        income: null,
        tag_ids: []
    };
    if (ruleFormRef.value) {
        ruleFormRef.value.resetFields();
    }
    dialogAdd.value = true;
}

const ruleFormRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()
const ruleForm = ref({
    key: '',
    payer: null as string | null | undefined,
    income: null as number | null | undefined,
    // currency_id: null as number | null,
    tag_ids: [] as number[],
})

const rules = ref<FormRules>({
    key: [
        { required: true, message: '请输入关键字', trigger: 'blur' },
        { max: 16, message: '长度应控制在16个字符以内', trigger: 'blur' },
    ],
    payer: [
        { required: false, message: '', trigger: 'change' },
        { max: 32, message: '长度应控制在32个字符以内', trigger: 'blur' },
    ],
    income: [
        { required: false, message: '请选择映射账户', trigger: 'change' },
    ],
    // currency_id: [
    //     { required: false, message: '请选择货币', trigger: 'change' },
    // ],
})

// 新增确认
const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            try {
                // 转换字段名以匹配后端API
                const submitData = {
                    key: ruleForm.value.key,
                    payer: ruleForm.value.payer,
                    income_id: ruleForm.value.income, // 将 income 转换为 income_id
                    // currency_ids: ruleForm.value.currency_id ? [ruleForm.value.currency_id] : []
                    tag_ids: ruleForm.value.tag_ids
                }

                console.log('收入映射提交数据:', submitData)

                axios({
                    url: 'income/',
                    data: submitData,
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(response => {
                        ElMessage.success('新增成功')
                        dialogAdd.value = false
                        fetchData() // 新增刷新
                        // console.log(response.data);
                    })
                    .catch(error => {
                        if (error.response && error.response.status == 401) {
                            ElMessage.info('未认证，请登录后重试');
                        }
                        else if (error.response && error.response.status == 403) {
                            ElMessage.info('权限不足，请登录后重试');
                        }
                        else if (error.response && error.response.status == 400) {
                            ElMessage.error(extractApiErrorMessage(error.response?.data, '新增失败，请检查关键字是否冲突'));
                        }
                        dialogError.value = false
                        console.error(error)
                    })
            } catch (error) {
                // console.log(error);
            }
        } else {
            // console.log('error submit!', fields)
        }
    })
}

function parseCsvEnable(v: unknown): boolean {
    if (v === false || v === true) return v
    const s = String(v ?? '').trim().toLowerCase()
    if (s === 'false' || s === '0' || s === '否') return false
    if (s === 'true' || s === '1' || s === '是') return true
    return true
}

function normalizeCsvRowKeys(item: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(item)) {
        out[k.replace(/^\ufeff/, '').trim()] = item[k]
    }
    return out
}

// 导出（扁平列含映射账户路径，不修改表格数据源）
const handleExport = () => {
    const rows = IncomeData.value.map((row: any) => ({
        key: row.key ?? '',
        payer: row.payer ?? '',
        映射账户: row.income?.account ?? '',
        enable: row.enable !== false,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'export_income.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

// 导入
const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = () => {
        const files = input.files;
        if (files && files.length > 0) {
            const file = files.item(0);
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                if (data) {
                    const workbook = XLSX.read(data, { type: 'string' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    let json = XLSX.utils.sheet_to_json(worksheet, { raw: false });

                    json = json.map((item: any) => {
                        const row = normalizeCsvRowKeys(item) as Record<string, unknown>
                        const incomeAccount = String(
                            row['映射账户'] ?? row.income_account ?? ''
                        ).trim()
                        return {
                            key: row.key ?? '',
                            payer: row.payer ?? '',
                            income_account: incomeAccount,
                            enable: parseCsvEnable(row.enable),
                        }
                    })

                    axios({
                        url: 'income/',
                        data: JSON.parse(JSON.stringify(json)),
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' }
                    })
                        .then(() => {
                            ElMessage.success('导入成功')
                            fetchData()
                        })
                        .catch(error => {
                            if (error.response && error.response.status == 401) {
                                ElMessage.info('未认证，请登录后重试');
                            }
                            else if (error.response && error.response.status == 403) {
                                ElMessage.info('权限不足，请登录后重试');
                            }
                            else if (error.response && error.response.status == 400) {
                                ElMessage.error(extractApiErrorMessage(error.response?.data, '导入失败，请按"导出"提供的格式重新导入'));
                            }
                            console.error(error);
                        });
                }
            };
            if (file !== null) {
                reader.readAsText(file);
            }
        }
    };
    input.click();
}

// 编辑
const dialogEdit = ref(false)

const handleEdit = (index: number, row: Income) => {
    ruleForm.value.key = row.key
    ruleForm.value.payer = row.payer !== null ? row.payer : null
    ruleForm.value.income = typeof row.income === 'object' && row.income ? row.income.id : (typeof row.income === 'number' ? row.income : null)
    ruleForm.value.tag_ids = row.tags?.map(tag => tag.id) || []
    editKnownTags.value = row.tags || []
    dialogEdit.value = true
    selectedId.value = row.id
    // console.log(index, row)
}

const handleSwitchChange = async (row: Income) => {
    try {
        // 立即更新本地状态
        row.enable = row.enable

        // 发送 API 请求
        await axios.patch(`income/${row.id}/`, {
            enable: row.enable
        })
        ElMessage.success('状态更新成功')
    } catch (error: any) {
        // 请求失败时回滚状态
        row.enable = !row.enable
        // ElMessage.error('状态更新失败')
        if (error.response && error.response.status == 401) {
            ElMessage.info('未认证，请登录后重试');
        }
        console.error(error)
    }
}

const editForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            try {
                // 转换字段名以匹配后端API
                const submitData = {
                    key: ruleForm.value.key,
                    payer: ruleForm.value.payer,
                    income_id: ruleForm.value.income, // 将 income 转换为 income_id
                    // currency_ids: ruleForm.value.currency_id ? [ruleForm.value.currency_id] : []
                    tag_ids: ruleForm.value.tag_ids
                }

                console.log('收入映射编辑提交数据:', submitData)

                axios({
                    url: `income/${selectedId.value}/`,
                    data: submitData,
                    method: "PUT",
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(response => {
                        ElMessage.success('修改成功')
                        dialogEdit.value = false
                        fetchData() // 新增刷新
                    })
                    .catch(error => {
                        if (error.response && error.response.status == 401) {
                            ElMessage.info('未认证，请登录后重试');
                        }
                        else if (error.response && error.response.status == 403) {
                            ElMessage.info('权限不足，请登录后重试');
                        }
                        else if (error.response && error.response.status == 400) {
                            ElMessage.error(extractApiErrorMessage(error.response?.data, '修改失败，请检查关键字是否冲突'));
                        }
                        else {
                            dialogError.value = true
                        }
                        console.error(error)
                    })
            } catch (error) {
                // console.log(error);
            }
        } else {
            // console.log('error submit!', fields)
        }
    })
}

// 删除
const dialogDel = ref(false)
const selectedId = ref(0)  // 编辑 & 删除均用这个

const handleDelete = (index: number, row: Income) => {
    dialogDel.value = true
    selectedId.value = row.id
    // console.log(index, row)
}

// 删除确认
const confirmDelete = async () => {
    try {
        const response = await axios.delete(`income/${selectedId.value}/`);
        ElMessage.success('删除成功')
        dialogDel.value = false
        await fetchData() // 新增刷新
    } catch (error: any) {
        dialogDel.value = false
        console.error(error);
        if (error.response && error.response.status == 401) {
            ElMessage.info('未认证，请登录后重试');
        }
        else if (error.response && error.response.status == 403) {
            ElMessage.info('权限不足，请登录后重试');
        }
        else if (error.response && error.response.status == 400) {
            ElMessage.error(extractApiErrorMessage(error.response?.data, '修改失败，请检查关键字是否冲突'));
        }
        else {
            dialogError.value = true
        }
    }
}

// 处理账户选择变化
const handleAccountChange = (account: any) => {
    // 账户变化时可以做一些额外处理
    console.log('账户选择变化:', account)
}

// 处理选择变化
const handleSelectionChange = (selection: Income[]) => {
    selectedItems.value = selection
}

// 批量启用
const handleBatchEnable = async () => {
    if (selectedItems.value.length === 0) return

    try {
        const promises = selectedItems.value.map(item =>
            axios.patch(`income/${item.id}/`, { enable: true })
        )
        await Promise.all(promises)
        ElMessage.success(`成功启用 ${selectedItems.value.length} 个映射`)
        await fetchData()
        selectedItems.value = []
    } catch (error: any) {
        console.error('批量启用失败:', error)
        ElMessage.error('批量启用失败')
    }
}

// 批量禁用
const handleBatchDisable = async () => {
    if (selectedItems.value.length === 0) return

    try {
        const promises = selectedItems.value.map(item =>
            axios.patch(`income/${item.id}/`, { enable: false })
        )
        await Promise.all(promises)
        ElMessage.success(`成功禁用 ${selectedItems.value.length} 个映射`)
        await fetchData()
        selectedItems.value = []
    } catch (error: any) {
        console.error('批量禁用失败:', error)
        ElMessage.error('批量禁用失败')
    }
}

// 批量删除相关状态
const batchDeleteDialog = ref(false)
const batchDeleteLoading = ref(false)
const batchDeleteProgress = ref(0)
const batchDeleteErrors = ref<string[]>([])

// 批量修改账户相关状态
const batchUpdateAccountDialog = ref(false)
const batchUpdateLoading = ref(false)
const batchUpdateProgress = ref(0)
const batchUpdateErrors = ref<string[]>([])
const batchUpdateFormRef = ref<FormInstance>()
const batchUpdateForm = ref({
    income: null as number | null
})

// 批量删除
const handleBatchDelete = () => {
    if (selectedItems.value.length === 0) return
    batchDeleteDialog.value = true
    batchDeleteErrors.value = []
    batchDeleteProgress.value = 0
}

// 确认批量删除
const confirmBatchDelete = async () => {
    if (selectedItems.value.length === 0) return

    batchDeleteLoading.value = true
    batchDeleteProgress.value = 0
    batchDeleteErrors.value = []

    const totalItems = selectedItems.value.length
    const errors: string[] = []
    let successCount = 0

    try {
        // 逐个删除以显示进度
        for (let i = 0; i < selectedItems.value.length; i++) {
            const item = selectedItems.value[i]
            try {
                await axios.delete(`income/${item.id}/`)
                successCount++
            } catch (error: any) {
                const errorMsg = `删除 "${item.key}" 失败: ${error.response?.data?.detail || error.message || '未知错误'}`
                errors.push(errorMsg)
                console.error(`删除收入映射失败 (ID: ${item.id}):`, error)
            }

            // 更新进度
            batchDeleteProgress.value = Math.round(((i + 1) / totalItems) * 100)
        }

        // 处理结果
        if (errors.length > 0) {
            batchDeleteErrors.value = errors
            if (successCount > 0) {
                ElMessage.warning(`成功删除 ${successCount} 个映射，${errors.length} 个失败`)
            } else {
                ElMessage.error('批量删除失败')
            }
        } else {
            ElMessage.success(`成功删除 ${successCount} 个收入映射`)
            batchDeleteDialog.value = false
            await fetchData()
            selectedItems.value = []
        }
    } catch (error: any) {
        console.error('批量删除过程出错:', error)
        ElMessage.error('批量删除过程中发生错误')
    } finally {
        batchDeleteLoading.value = false
    }
}

// 取消批量删除
const cancelBatchDelete = () => {
    batchDeleteDialog.value = false
    batchDeleteErrors.value = []
    batchDeleteProgress.value = 0
}

const handleBatchUpdateAccount = () => {
    if (selectedItems.value.length === 0) return
    batchUpdateAccountDialog.value = true
    batchUpdateErrors.value = []
    batchUpdateProgress.value = 0
    batchUpdateForm.value = { income: null }
}

const handleBatchAccountChange = () => {}

const confirmBatchUpdateAccount = async () => {
    if (selectedItems.value.length === 0 || !batchUpdateForm.value.income) return

    batchUpdateLoading.value = true
    batchUpdateProgress.value = 0
    batchUpdateErrors.value = []

    const totalItems = selectedItems.value.length
    const errors: string[] = []

    try {
        const response = await axios.post('income/batch_update_account/', {
            income_ids: selectedItems.value.map(item => item.id),
            income_id: batchUpdateForm.value.income
        })

        const successCount = response.data?.updated_count ?? 0
        batchUpdateProgress.value = 100

        if (successCount === totalItems) {
            ElMessage.success(`成功更新 ${successCount} 个收入映射`)
            batchUpdateAccountDialog.value = false
            await fetchData()
            selectedItems.value = []
        } else {
            ElMessage.warning(`成功更新 ${successCount} 个映射，${totalItems - successCount} 个失败`)
            batchUpdateErrors.value = [`${totalItems - successCount} 个映射更新失败`]
        }
    } catch (error: any) {
        console.error('批量更新账户失败:', error)
        if (error.response?.data?.error) {
            errors.push(error.response.data.error)
        } else if (error.response?.data?.detail) {
            errors.push(error.response.data.detail)
        } else {
            errors.push('批量更新过程中发生未知错误')
        }
        batchUpdateErrors.value = errors
        ElMessage.error('批量更新失败')
    } finally {
        batchUpdateLoading.value = false
    }
}

const cancelBatchUpdateAccount = () => {
    batchUpdateAccountDialog.value = false
    batchUpdateErrors.value = []
    batchUpdateProgress.value = 0
    batchUpdateForm.value = { income: null }
}

// 高级排序方法：处理数字、英文和中文混合内容
const advancedSort = (a: Income, b: Income): number => {
    // 提取数字部分（如果有）
    const numA = parseInt(a.key.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.key.match(/\d+/)?.[0] || '0');

    // 如果都有数字且数字不同，按数字排序
    if (numA !== numB) {
        return numA - numB;
    }

    // 否则按拼音排序
    const pinyinA = pinyin(a.key, {
        toneType: 'none',
        pattern: 'first',
        type: 'string'
    }).toLowerCase();

    const pinyinB = pinyin(b.key, {
        toneType: 'none',
        pattern: 'first',
        type: 'string'
    }).toLowerCase();

    if (pinyinA < pinyinB) return -1;
    if (pinyinA > pinyinB) return 1;
    return 0;
};

// 映射账户排序方法：处理中文字符串排序
const sortByAccount = (a: Income, b: Income): number => {
    const accountA = typeof a.income === 'string' ? a.income : a.income?.account || '';
    const accountB = typeof b.income === 'string' ? b.income : b.income?.account || '';

    // 按拼音排序
    const pinyinA = pinyin(accountA, {
        toneType: 'none',
        pattern: 'first',
        type: 'string'
    }).toLowerCase();

    const pinyinB = pinyin(accountB, {
        toneType: 'none',
        pattern: 'first',
        type: 'string'
    }).toLowerCase();

    if (pinyinA < pinyinB) return -1;
    if (pinyinA > pinyinB) return 1;
    return 0;
};


</script>

<style scoped>
.income-mapping {
    padding: 20px;
    background: var(--el-bg-color);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    gap: 16px;
    flex-wrap: wrap;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
}

.search-section {
    flex: 1;
    display: flex;
    gap: 8px;
    min-width: 200px;
    max-width: 400px;
}

.action-section {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.account-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    min-width: 0;
}

.currency-cell {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    min-width: 0;
}

/* 表格自适应优化 */
:deep(.el-table) {
    table-layout: auto;
}

:deep(.el-table__body-wrapper) {
    overflow-x: auto;
}

/* 确保表格列能够自适应内容 */
:deep(.el-table th),
:deep(.el-table td) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 关键字列特殊处理 */
:deep(.el-table .el-tag) {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
}

.currency-tag {
    margin: 0;
}

.batch-actions {
    margin-top: 16px;
}

.batch-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.dialog-footer button:first-child {
    margin-right: 10px;
}

/* 批量删除对话框样式 */
.batch-delete-content,
.batch-update-content {
    padding: 10px 0;
}

.update-progress {
    margin: 20px 0;
    text-align: center;
}

.update-errors {
    margin-top: 20px;
}

.delete-items-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    background-color: var(--el-fill-color-light);
    margin-bottom: 20px;
}

.delete-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color);
    transition: background-color 0.2s ease;
}

.delete-item:last-child {
    border-bottom: none;
}

.delete-item:hover {
    background-color: var(--el-fill-color-lighter);
}

.item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.item-main {
    display: flex;
    align-items: center;
    gap: 8px;
}

.item-payer {
    color: var(--el-text-color-regular);
    font-size: 14px;
}

.item-account {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    background-color: var(--el-color-primary-light-9);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
}

.item-index {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 500;
    background-color: var(--el-fill-color);
    padding: 4px 8px;
    border-radius: 12px;
    min-width: 24px;
    text-align: center;
}

.delete-progress {
    margin: 20px 0;
    text-align: center;
}

.progress-text {
    margin-top: 8px;
    color: var(--el-text-color-regular);
    font-size: 14px;
}

.delete-errors {
    margin-top: 20px;
}

.error-list {
    margin: 0;
    padding-left: 20px;
}

.error-item {
    margin-bottom: 4px;
    color: var(--el-color-danger);
    font-size: 13px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

/* 响应式设计 */
@media (max-width: 1200px) {

    /* 中等屏幕优化 */
    .account-cell {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
    }
}

@media (max-width: 768px) {
    .income-mapping {
        padding: 12px;
    }

    .toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .search-section {
        max-width: none;
    }

    .action-section {
        justify-content: center;
    }

    .delete-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }

    .item-index {
        align-self: flex-end;
    }

    /* 小屏幕表格优化 */
    :deep(.el-table) {
        font-size: 12px;
    }

    :deep(.el-tag) {
        font-size: 11px;
        padding: 2px 6px;
    }

    :deep(.el-button--small) {
        padding: 4px 8px;
        font-size: 11px;
    }
}

@media (max-width: 480px) {

    /* 超小屏幕进一步优化 */
    .account-cell {
        gap: 2px;
    }

    .currency-cell {
        gap: 2px;
    }
}

/* 标签相关样式 */
.tags-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.tag-management-dialog {
    padding: 10px 0;
}

.current-tags-section,
.add-tags-section {
    margin-bottom: 20px;
}

.current-tags-section h4,
.add-tags-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.current-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 32px;
}
</style>