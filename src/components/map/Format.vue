<template>
    <!-- 匿名用户提示 -->
    <AnonymousPrompt v-model="showAnonymousPrompt" @skip="handleSkipAnonymous" />

    <!-- 格式配置面板，只在非匿名用户或已跳过提示时显示 -->
    <el-form v-if="!showAnonymousPrompt" class="format-config" :model="formModel" :rules="formRules" ref="configForm">
        <el-collapse v-model="activePanels" class="config-panel">
            <!-- 模板配置 -->
            <el-collapse-item title="高级配置" name="template" class="config-item">
                <div class="config-group">
                    <el-divider>账户模板配置</el-divider>

                    <!-- 收入模板组 -->
                    <div class="template-group">
                        <div class="template-input-group">
                            <div class="template-input-prepend">优惠收入模板</div>
                            <div class="template-input-content">
                                <AccountSelector v-model="incomeTemplateId" :account-tree="accountTree"
                                    :show-details="false" placeholder="请选择收入账户" @change="handleIncomeTemplateChange" />
                            </div>
                        </div>

                        <div class="template-input-group">
                            <div class="template-input-prepend">手续费模板</div>
                            <div class="template-input-content">
                                <AccountSelector v-model="commissionTemplateId" :account-tree="accountTree"
                                    :show-details="false" placeholder="请选择手续费账户"
                                    @change="handleCommissionTemplateChange" />
                            </div>
                        </div>

                        <div class="template-input-group">
                            <div class="template-input-prepend">
                                <div class="label-with-tip">
                                    <span>兜底账户</span>
                                    <el-tooltip content="无法匹配资产账户时的默认账户，也用于对账差额分配" placement="top">
                                        <el-icon class="tip-icon">
                                            <Warning />
                                        </el-icon>
                                    </el-tooltip>
                                </div>
                            </div>
                            <div class="template-input-content">
                                <AccountSelector v-model="reconciliationFallbackAccountId" :account-tree="accountTree"
                                    :show-details="false" placeholder="请选择兜底账户"
                                    @change="handleReconciliationFallbackChange" />
                            </div>
                        </div>

                        <el-form-item prop="currency" class="template-form-item" :rules="[
                            {
                                pattern: /^[A-Z][A-Z0-9'._-]{0,22}([A-Z0-9])?$/,
                                message: '货币必须以大写字母开头，以大写字母/数字结尾，并且只能包含 [A-Z0-9\'._-]',
                                trigger: 'blur'
                            }
                        ]">
                            <div class="template-input-group">
                                <div class="template-input-prepend">
                                    <div class="label-with-tip">
                                        <span>基础货币模板</span>
                                        <el-tooltip content="货币必须以大写字母开头，以大写字母/数字结尾，并且只能包含 [A-Z0-9'._-]"
                                            placement="top">
                                            <el-icon class="tip-icon">
                                                <Warning />
                                            </el-icon>
                                        </el-tooltip>
                                    </div>
                                </div>
                                <div class="template-input-content">
                                    <el-input v-model="currency" placeholder="输入基础货币（如：CNY）" clearable />
                                </div>
                            </div>
                        </el-form-item>
                    </div>
                </div>
            </el-collapse-item>

            <!-- 解析设置 -->
            <el-collapse-item title="解析设置" name="parsing" class="config-item">
                <div class="config-group">
                    <el-divider>多文件解析模式</el-divider>
                    <el-form-item>
                        <div class="parsing-mode-container">
                            <el-radio-group v-model="parsingModePreference">
                                <el-radio label="review">审核模式</el-radio>
                                <el-radio label="direct_write">直接写入模式</el-radio>
                            </el-radio-group>
                            <el-alert type="info" show-icon :closable="false" class="mode-alert">
                                <template v-if="parsingModePreference === 'review'">
                                    <strong>审核模式：</strong>解析完成后需要用户审核，可以选择关键字或直接编辑条目，确认后再写入账本
                                </template>
                                <template v-else>
                                    <strong>直接写入模式：</strong>解析完成后立即写入账本，适合对AI分类有较高信任度的用户
                                </template>
                            </el-alert>
                        </div>
                    </el-form-item>

                    <el-divider>资产账户自动补齐</el-divider>
                    <el-form-item>
                        <div class="auto-provision-container">
                            <div class="auto-provision-row">
                                <el-switch v-model="autoProvisionAssets" />
                                <span class="auto-provision-label">解析成功后自动补齐资产账户与映射</span>
                                <el-tooltip
                                    content="付款方式能识别出银行、卡号或平台账户时自动创建账户与资产映射；识别不出时仍记为 Assets:Other"
                                    placement="top">
                                    <el-icon class="tip-icon">
                                        <Warning />
                                    </el-icon>
                                </el-tooltip>
                            </div>
                            <el-alert type="info" show-icon :closable="false" class="mode-alert">
                                关闭后，解析结果只读取已有映射，未匹配的付款方式保持记为 <strong>Assets:Other</strong>。
                            </el-alert>
                        </div>
                    </el-form-item>

                    <el-divider>解析引擎（用于文件管理后台解析）</el-divider>
                    <el-form-item label="解析引擎" prop="aiModel">
                        <div class="ai-engine-container">
                            <el-select v-model="aiModel" placeholder="选择解析引擎" class="model-selector"
                                :disabled="!isAuthenticated">
                                <el-option label="单规则匹配" value="None" :disabled="!isAuthenticated" />
                                <el-option label="BERT - 本地模型（默认，平衡模式）" value="BERT" :disabled="!isAuthenticated" />
                                <el-option label="DeepSeek - 自有密钥（高精度模式）" value="DeepSeek"
                                    :disabled="!isAuthenticated || !hasUserAssistantKey" />
                            </el-select>

                            <el-alert v-if="!isAuthenticated" type="info" :closable="false"
                                class="engine-description-alert">
                                未登录时默认使用本地 BERT；登录后可选择单规则匹配、BERT 或自有 DeepSeek 密钥。解析首页不读取这里的引擎设置。
                            </el-alert>
                            <el-alert v-else-if="engineDescription" type="info" :closable="false"
                                class="engine-description-alert">
                                {{ engineDescription }}
                            </el-alert>
                        </div>
                    </el-form-item>
                </div>
            </el-collapse-item>

            <!-- Copilot -->
            <el-collapse-item title="BYOK" name="assistant" class="config-item">
                <div class="config-group">
                    <el-form-item label="Provider 预设">
                        <el-select v-model="assistantPreset" class="model-selector" @change="applyAssistantPreset">
                            <el-option label="DeepSeek" value="deepseek" />
                            <el-option label="Ollama（本地）" value="ollama" />
                            <el-option label="自定义" value="custom" />
                        </el-select>
                    </el-form-item>

                    <el-form-item label="接口地址">
                        <el-input v-model="assistantBaseUrl" placeholder="例如 https://api.deepseek.com" clearable />
                    </el-form-item>

                    <el-form-item label="API 密钥">
                        <div class="api-key-row">
                            <el-input v-model="assistantApiKey" type="password"
                                placeholder="未填写时 Copilot 可走平台密钥；自有解析引擎需填写" show-password clearable />
                            <el-button @click="testApiKey" :loading="loading.test">测试</el-button>
                        </div>
                    </el-form-item>

                    <el-form-item label="模型名称">
                        <el-input v-model="assistantModel" placeholder="例如 deepseek-v4-flash" clearable />
                    </el-form-item>

                    <el-alert type="info" :closable="false" class="engine-description-alert">
                        Copilot 只读查询账本，不会改账。账单解析默认使用本地 BERT；如需云端解析，可在解析首页勾选「平台 LLM」，或把解析引擎切到「DeepSeek -
                        自有密钥」后使用这里填写的密钥与模型。
                    </el-alert>
                </div>
            </el-collapse-item>
        </el-collapse>
    </el-form>

    <!-- 操作按钮 -->
    <div v-if="!showAnonymousPrompt" class="action-buttons">
        <el-button type="primary" @click="validateAndSubmit" :loading="loading.save">
            应用配置
        </el-button>
        <el-button @click="resetToDefault" :loading="loading.reset">
            恢复默认
        </el-button>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import AnonymousPrompt from '../common/AnonymousPrompt.vue'
import AccountSelector from '../common/AccountSelector.vue'
import { hasAuthTokens } from '../../utils/auth'
import { shouldShowAnonymousPrompt } from '~/composables/useAnonymousPrompt'
import type { FormInstance } from 'element-plus'

const configForm = ref<FormInstance>()
const formModel = computed(() => ({
    aiModel: aiModel.value,
    assistantApiKey: assistantApiKey.value,
}))
const formRules = computed(() => ({
    aiModel: isAuthenticated.value
        ? [{ required: true, message: '请选择解析引擎', trigger: 'change' }]
        : [],
}))

// 修改提交方法
const validateAndSubmit = async () => {
    try {
        await configForm.value?.validate()
        if (aiModel.value === 'DeepSeek' && !assistantApiKey.value.trim()) {
            ElMessage.error('自有 DeepSeek 解析需要先在 BYOK 填写 API 密钥')
            return
        }
        await applyConfig()
    } catch (error) {
        // 验证失败会自动显示错误信息
    }
}

interface AccountOption {
    id: number
    account: string
    account_type?: string
    description?: string
    children?: AccountOption[]
}

interface Config {
    flag: string
    show_note: boolean
    show_tag: boolean
    show_time: boolean
    show_uuid: boolean
    show_status: boolean
    show_discount: boolean
    income_template?: string
    commission_template?: string
    reconciliation_fallback_account?: string
    currency?: string
    ai_model?: string
    deepseek_apikey?: string
    assistant_base_url?: string
    assistant_api_key?: string
    assistant_model?: string
    enable_realtime?: boolean
    parsing_mode_preference?: string
    auto_provision_assets?: boolean
}

type AssistantPreset = 'deepseek' | 'ollama' | 'custom'

const ASSISTANT_PRESETS: Record<AssistantPreset, { baseUrl: string; model: string }> = {
    deepseek: {
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
    },
    ollama: {
        baseUrl: 'http://127.0.0.1:11434/v1',
        model: '',
    },
    custom: {
        baseUrl: '',
        model: '',
    },
}

// 响应式配置状态
const activePanels = ref(['template', 'parsing', 'assistant'])
const formatSettings = ref<string[]>([])
const accountTree = ref<AccountOption[]>([])
const incomeTemplate = ref('')
const commissionTemplate = ref('')
const reconciliationFallbackAccount = ref('Equity:Adjustments')
const incomeTemplateId = ref<number | null>(null)
const commissionTemplateId = ref<number | null>(null)
const reconciliationFallbackAccountId = ref<number | null>(null)
const currency = ref('')
const aiModel = ref('BERT') // 默认使用本地 BERT；平台 LLM 在解析首页按次选择
const isAuthenticated = ref(hasAuthTokens())
const assistantPreset = ref<AssistantPreset>('deepseek')
const assistantBaseUrl = ref('')
const assistantApiKey = ref('')
const assistantModel = ref('')
const flagSymbol = ref('*')
const parsingModePreference = ref('review') // 默认审核模式
const autoProvisionAssets = ref(true) // 默认解析成功后自动补齐资产账户与映射

const loading = ref({
    save: false,
    reset: false,
    test: false,
})

// 匿名用户提示
const showAnonymousPrompt = ref(false)

const hasUserAssistantKey = computed(() => assistantApiKey.value.trim() !== '')

const engineDescription = computed(() => {
    switch (aiModel.value) {
        case 'None':
            return '仅按关键词与账户层级规则选择，不调用模型'
        case 'BERT':
            return '后台多文件解析默认使用本地模型，不调用云端大模型'
        case 'DeepSeek':
            return '后台多文件解析使用你在 BYOK 中填写的密钥与模型'
        default:
            return ''
    }
})

// 转换配置格式：前端 camelCase <-> 后端 snake_case
const convertToFrontend = (config: Config) => {
    const engine = config.ai_model === 'spaCy' || config.ai_model === 'Platform' ? 'BERT' : (config.ai_model || 'BERT')
    return {
        flag: config.flag,
        incomeTemplate: config.income_template || '',
        commissionTemplate: config.commission_template || '',
        reconciliationFallbackAccount: config.reconciliation_fallback_account || 'Equity:Adjustments',
        currency: config.currency || 'CNY',
        aiModel: ['None', 'BERT', 'DeepSeek'].includes(engine) ? engine : 'BERT',
        assistantBaseUrl: config.assistant_base_url || '',
        assistantApiKey: config.assistant_api_key || config.deepseek_apikey || '',
        assistantModel: config.assistant_model || '',
        parsingModePreference: config.parsing_mode_preference || 'review',
        autoProvisionAssets: config.auto_provision_assets !== false,

        formatSettings: [
            ...(config.show_note ? ['showNote'] : []),
            ...(config.show_tag ? ['showTag'] : []),
            ...(config.show_time ? ['showTime'] : []),
            ...(config.show_uuid ? ['showUUID'] : []),
            ...(config.show_status ? ['showStatus'] : []),
            ...(config.show_discount ? ['showDiscount'] : [])
        ]
    }
}

const findAccountByName = (accounts: AccountOption[], accountName: string): AccountOption | null => {
    for (const account of accounts) {
        if (account.account === accountName) {
            return account
        }
        if (account.children) {
            const found = findAccountByName(account.children, accountName)
            if (found) return found
        }
    }
    return null
}

const syncAccountIdsFromPaths = () => {
    incomeTemplateId.value = incomeTemplate.value
        ? findAccountByName(accountTree.value, incomeTemplate.value)?.id ?? null
        : null
    commissionTemplateId.value = commissionTemplate.value
        ? findAccountByName(accountTree.value, commissionTemplate.value)?.id ?? null
        : null
    reconciliationFallbackAccountId.value = reconciliationFallbackAccount.value
        ? findAccountByName(accountTree.value, reconciliationFallbackAccount.value)?.id ?? null
        : null
}

const loadAccountTree = async () => {
    try {
        const response = await axios.get('/account/tree/')
        if (Array.isArray(response.data)) {
            accountTree.value = response.data as AccountOption[]
        } else if (response.data && Array.isArray(response.data.results)) {
            accountTree.value = response.data.results as AccountOption[]
        } else {
            accountTree.value = []
        }
    } catch {
        accountTree.value = []
    }
}

const handleIncomeTemplateChange = (account: AccountOption | null) => {
    incomeTemplate.value = account?.account ?? ''
}

const handleCommissionTemplateChange = (account: AccountOption | null) => {
    commissionTemplate.value = account?.account ?? ''
}

const handleReconciliationFallbackChange = (account: AccountOption | null) => {
    reconciliationFallbackAccount.value = account?.account ?? ''
}

function detectAssistantPreset(baseUrl: string, model: string): AssistantPreset {
    const normalizedUrl = baseUrl.trim()
    const normalizedModel = model.trim()
    if (normalizedUrl === ASSISTANT_PRESETS.deepseek.baseUrl
        && (!normalizedModel || normalizedModel === ASSISTANT_PRESETS.deepseek.model)) {
        return 'deepseek'
    }
    if (normalizedUrl.startsWith('http://127.0.0.1:11434')
        || normalizedUrl.startsWith('http://localhost:11434')) {
        return 'ollama'
    }
    if (!normalizedUrl && !normalizedModel) {
        return 'deepseek'
    }
    return 'custom'
}

function applyAssistantPreset(preset: AssistantPreset) {
    const presetConfig = ASSISTANT_PRESETS[preset]
    if (preset === 'custom') {
        return
    }
    assistantBaseUrl.value = presetConfig.baseUrl
    if (presetConfig.model) {
        assistantModel.value = presetConfig.model
    }
}

// 加载用户配置
const loadConfig = async () => {
    try {
        const [, { data }] = await Promise.all([
            loadAccountTree(),
            axios.get<Config>('config/')
        ])
        const frontendConfig = convertToFrontend(data)
        aiModel.value = frontendConfig.aiModel
        assistantBaseUrl.value = frontendConfig.assistantBaseUrl
        assistantApiKey.value = frontendConfig.assistantApiKey
        assistantModel.value = frontendConfig.assistantModel
        assistantPreset.value = detectAssistantPreset(
            frontendConfig.assistantBaseUrl,
            frontendConfig.assistantModel,
        )
        formatSettings.value = frontendConfig.formatSettings
        incomeTemplate.value = frontendConfig.incomeTemplate
        commissionTemplate.value = frontendConfig.commissionTemplate
        reconciliationFallbackAccount.value = frontendConfig.reconciliationFallbackAccount
        flagSymbol.value = frontendConfig.flag
        currency.value = frontendConfig.currency
        parsingModePreference.value = frontendConfig.parsingModePreference
        autoProvisionAssets.value = frontendConfig.autoProvisionAssets
        syncAccountIdsFromPaths()
    } catch (error: any) {
        if (error.response && error.response.status == 401) {
            ElMessage.info('未认证，请登录后重试');
        }
    }
}

// 处理匿名用户跳过提示
const handleSkipAnonymous = () => {
    showAnonymousPrompt.value = false
    // 继续加载配置，显示admin用户的共享配置
    loadConfig()
}

// 初始化加载配置
onMounted(() => {
    if (isAuthenticated.value) {
        // 已登录用户直接加载配置
        loadConfig()
    } else {
        // 未登录用户：检查是否应该显示提示（仅显示一次）
        if (shouldShowAnonymousPrompt(false)) {
            showAnonymousPrompt.value = true
        } else {
            // 如果用户已经看过提示，直接加载配置，显示admin用户的共享配置
            loadConfig()
        }
    }
})

// 生成请求体
const currentConfig = computed(() => {
    const config: Config = {
        flag: flagSymbol.value,
        show_note: formatSettings.value.includes('showNote'),
        show_tag: formatSettings.value.includes('showTag'),
        show_time: formatSettings.value.includes('showTime'),
        show_uuid: formatSettings.value.includes('showUUID'),
        show_status: formatSettings.value.includes('showStatus'),
        show_discount: formatSettings.value.includes('showDiscount'),
        income_template: incomeTemplate.value,
        commission_template: commissionTemplate.value,
        reconciliation_fallback_account: reconciliationFallbackAccount.value,
        currency: currency.value,
        parsing_mode_preference: parsingModePreference.value,
        auto_provision_assets: autoProvisionAssets.value,
        assistant_base_url: assistantBaseUrl.value.trim(),
        assistant_api_key: assistantApiKey.value.trim(),
        assistant_model: assistantModel.value.trim(),
    }
    if (aiModel.value) {
        config.ai_model = aiModel.value
    }

    return config
})

// 应用配置
const applyConfig = async () => {
    try {
        loading.value.save = true
        await axios.put('config/', currentConfig.value)
        ElMessage.success('配置已保存')
    } catch (error: any) {
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    ElMessage.error('未认证，请登录后重试')
                    break
                case 400:
                    ElMessage.error(`配置保存失败: ${formatConfigError(error.response.data)}`)
                    break
                default:
                    ElMessage.error('配置保存失败，请稍后重试')
            }
        } else {
            ElMessage.error('网络错误，请检查连接')
        }
    } finally {
        loading.value.save = false
    }
}

const formatConfigError = (data: unknown) => {
    if (!data || typeof data !== 'object') {
        return '参数错误'
    }
    const payload = data as Record<string, unknown>
    if (typeof payload.message === 'string') {
        return payload.message
    }
    const firstField = Object.values(payload)[0]
    if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
        return firstField[0]
    }
    if (typeof firstField === 'string') {
        return firstField
    }
    return '参数错误'
}

const testApiKey = async () => {
    try {
        loading.value.test = true
        const { data } = await axios.post('assistant/test-key/', {
            api_key: assistantApiKey.value.trim(),
            base_url: assistantBaseUrl.value.trim(),
            model: assistantModel.value.trim(),
        })
        if (data.ok && data.parse_available) {
            ElMessage.success(data.detail)
        } else if (data.ok) {
            ElMessage.warning(data.detail)
        } else {
            ElMessage.error(data.detail)
        }
    } catch (error: any) {
        if (error.response?.status === 401) {
            ElMessage.error('未认证，请登录后重试')
        } else {
            ElMessage.error(error.response?.data?.detail || '密钥测试失败')
        }
    } finally {
        loading.value.test = false
    }
}

// 重置为默认配置
const resetToDefault = async () => {
    try {
        loading.value.reset = true
        await axios.put('config/', {
            flag: '*',
            show_note: true,
            show_tag: true,
            show_time: true,
            show_uuid: true,
            show_status: true,
            show_discount: true,
            income_template: 'Income:Transfer:Organizational',
            commission_template: 'Expenses:Finance:Commission',
            reconciliation_fallback_account: 'Equity:Adjustments',
            currency: 'CNY',
            ai_model: 'BERT',
            parsing_mode_preference: 'review',
            auto_provision_assets: true,
            assistant_base_url: '',
            assistant_api_key: '',
            assistant_model: '',
            deepseek_apikey: '',
        })
        await loadConfig() // 重新加载最新配置
        ElMessage.success('已恢复默认配置')
    } catch (error: any) {
        if (error.response && error.response.status == 401) {
            ElMessage.error('未认证，请登录后重试')
        } else {
            ElMessage.error('重置配置失败')
        }
    } finally {
        loading.value.reset = false
    }
}
</script>

<style scoped>
.template-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.template-form-item {
    margin-bottom: 0;
}

.template-form-item :deep(.el-form-item__content) {
    line-height: normal;
}

.template-input-group {
    display: flex;
    width: 100%;
    align-items: stretch;
}

.template-input-prepend {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 20px;
    background-color: var(--ep-fill-color-light, var(--el-fill-color-light));
    color: var(--ep-text-color-regular, var(--el-text-color-regular));
    border: 1px solid var(--ep-border-color, var(--el-border-color));
    border-right: none;
    border-radius: var(--ep-border-radius-base, var(--el-border-radius-base)) 0 0 var(--ep-border-radius-base, var(--el-border-radius-base));
    font-size: var(--ep-font-size-base, var(--el-font-size-base));
    white-space: nowrap;
    box-shadow:
        1px 0 0 0 var(--ep-border-color, var(--el-border-color)) inset,
        0 1px 0 0 var(--ep-border-color, var(--el-border-color)) inset,
        0 -1px 0 0 var(--ep-border-color, var(--el-border-color)) inset;
}

.template-input-content {
    flex: 1;
    min-width: 0;
}

.template-input-content :deep(.account-selector) {
    width: 100%;
}

.template-input-content :deep(.ep-input__wrapper),
.template-input-content :deep(.el-input__wrapper) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
}

.template-input-group:focus-within .template-input-prepend {
    border-color: var(--ep-color-primary, var(--el-color-primary));
    box-shadow:
        1px 0 0 0 var(--ep-color-primary, var(--el-color-primary)) inset,
        0 1px 0 0 var(--ep-color-primary, var(--el-color-primary)) inset,
        0 -1px 0 0 var(--ep-color-primary, var(--el-color-primary)) inset;
}

.tip-icon {
    color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
    cursor: help;
}

.config-item {
    padding: 0 16px;
}

.config-group {
    padding: 0 16px;
}

.label-with-tip {
    display: flex;
    align-items: center;
    gap: 6px;
}

.model-selector {
    width: 100%;
}

.api-key-row {
    display: flex;
    width: 100%;
    gap: 8px;
}

.api-key-row .el-input {
    flex: 1;
}

.el-form-item {
    margin-bottom: 18px;
}

.ai-engine-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.parsing-mode-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.auto-provision-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.auto-provision-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.auto-provision-label {
    color: var(--ep-text-color-regular, var(--el-text-color-regular));
}

.mode-alert,
.engine-description-alert {
    margin-top: 5px;
}

.action-buttons {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 30px;
    margin-bottom: 20px;
}

html.dark .format-config .template-input-prepend {
    background-color: var(--ep-fill-color-dark, var(--el-fill-color-dark));
    color: var(--ep-text-color-regular, var(--el-text-color-regular));
    border-color: var(--ep-border-color, var(--el-border-color));
    box-shadow:
        1px 0 0 0 var(--ep-border-color, var(--el-border-color)) inset,
        0 1px 0 0 var(--ep-border-color, var(--el-border-color)) inset,
        0 -1px 0 0 var(--ep-border-color, var(--el-border-color)) inset;
}

html.dark .format-config .template-input-group:focus-within .template-input-prepend {
    border-color: var(--ep-color-primary, var(--el-color-primary));
    box-shadow:
        1px 0 0 0 var(--ep-color-primary, var(--el-color-primary)) inset,
        0 1px 0 0 var(--ep-color-primary, var(--el-color-primary)) inset,
        0 -1px 0 0 var(--ep-color-primary, var(--el-color-primary)) inset;
}

html.dark .format-config .tip-icon {
    color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
}
</style>
