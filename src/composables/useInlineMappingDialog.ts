import { ref, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import axios from '../utils/request'

export type MappingType = 'expense' | 'income' | 'asset'

const MAPPING_KEY_MAX_LENGTH = 16

/** 从账单原始行的对方/商品信息生成新增映射的默认关键字 */
export function defaultMappingKeyFromOriginalRow(originalRow?: {
  counterparty?: string
  commodity?: string
}): string {
  const counterparty = originalRow?.counterparty?.trim()
  if (counterparty && counterparty !== '/') {
    return counterparty.substring(0, MAPPING_KEY_MAX_LENGTH)
  }
  const commodity = originalRow?.commodity?.trim()
  if (commodity) {
    return commodity.substring(0, MAPPING_KEY_MAX_LENGTH)
  }
  return ''
}

/** 从账单原始行的支付方式生成新增资产映射的默认关键字 */
export function defaultAssetMappingKeyFromOriginalRow(originalRow?: {
  payment_method?: string
}): string {
  let key = originalRow?.payment_method?.trim() ?? ''
  if (key.includes('&')) {
    key = key.split('&')[0]
  }
  return key.substring(0, MAPPING_KEY_MAX_LENGTH)
}

interface MappingListItem {
  id: number
  key: string
  payee?: string | null
  payer?: string | null
  expend?: { id: number } | number | null
  income?: { id: number } | number | null
  assets?: { id: number } | number | null
  tags?: Array<{ id: number }>
}

export interface OpenMappingOptions<T> {
  row: T
  inferType: (row: T) => MappingType
  getSelectedKey: (row: T) => string | undefined
  getCreateDefaults: (row: T) => {
    key: string
    party: string
    type: MappingType
  }
  onReparse: (key: string, type: MappingType) => Promise<void>
  requireAuth?: () => boolean
}

function accountIdFromMapping(item: MappingListItem, type: MappingType): number | null {
  if (type === 'asset') {
    const field = item.assets
    if (field == null) return null
    if (typeof field === 'number') return field
    return field.id ?? null
  }
  const field = type === 'expense' ? item.expend : item.income
  if (field == null) return null
  if (typeof field === 'number') return field
  return field.id ?? null
}

function partyFromMapping(item: MappingListItem, type: MappingType): string {
  if (type === 'expense') return item.payee ?? ''
  return item.payer ?? ''
}

function tagIdsFromMapping(item: MappingListItem): number[] {
  return item.tags?.map((tag) => tag.id) ?? []
}

function mappingEndpoint(type: MappingType): string {
  if (type === 'expense') return 'expense/'
  if (type === 'income') return 'income/'
  return 'assets/'
}

async function fetchMappingByKey(type: MappingType, key: string): Promise<MappingListItem | null> {
  const response = await axios.get<MappingListItem[]>(mappingEndpoint(type))
  const list = Array.isArray(response.data) ? response.data : []
  return list.find((m) => m.key === key) ?? null
}

interface OfficialTemplateItem {
  key: string
  account?: string | null
  payee?: string | null
  payer?: string | null
}

type OfficialTemplateType = MappingType | 'assets'

const officialTemplateItemsCache: Partial<Record<OfficialTemplateType, OfficialTemplateItem[]>> = {}

function officialTemplateApiType(type: MappingType): OfficialTemplateType {
  return type === 'asset' ? 'assets' : type
}

async function fetchOfficialTemplateItems(type: MappingType): Promise<OfficialTemplateItem[]> {
  const apiType = officialTemplateApiType(type)
  if (officialTemplateItemsCache[apiType]) {
    return officialTemplateItemsCache[apiType]!
  }
  const response = await axios.get<Array<{ id: number }>>('/templates/', {
    params: { type: apiType, is_official: true }
  })
  const templates = Array.isArray(response.data) ? response.data : []
  const items: OfficialTemplateItem[] = []
  for (const template of templates) {
    try {
      const detail = await axios.get<{ items?: OfficialTemplateItem[] }>(
        `/templates/${template.id}/`
      )
      items.push(...(detail.data.items ?? []))
    } catch {
      // 忽略单个模板详情加载失败
    }
  }
  officialTemplateItemsCache[apiType] = items
  return items
}

async function fetchOfficialTemplateItemByKey(
  type: MappingType,
  key: string
): Promise<OfficialTemplateItem | null> {
  const items = await fetchOfficialTemplateItems(type)
  return items.find((item) => item.key === key) ?? null
}

async function resolveAccountIdByPath(accountPath?: string | null): Promise<number | null> {
  const path = accountPath?.trim()
  if (!path) return null
  try {
    const response = await axios.get<Array<{ id: number; account: string }>>('/account/', {
      params: { search: path }
    })
    const list = Array.isArray(response.data) ? response.data : []
    const exact = list.find((item) => item.account === path)
    return exact?.id ?? null
  } catch {
    return null
  }
}

export function useInlineMappingDialog() {
  const mappingFormRef = ref<FormInstance>()
  const mappingDialog = ref({
    visible: false,
    loading: false,
    mode: 'create' as 'create' | 'edit',
    mappingId: null as number | null
  })

  const mappingForm = ref({
    type: 'expense' as MappingType,
    key: '',
    accountId: null as number | null,
    party: '',
    tag_ids: [] as number[]
  })

  const mappingRules: FormRules = {
    key: [
      { required: true, message: '请输入关键字', trigger: 'blur' },
      { max: 16, message: '长度应控制在16个字符以内', trigger: 'blur' }
    ]
  }

  const mappingPartyLabel = computed(() =>
    mappingForm.value.type === 'income' ? '付款方' : '对方'
  )

  const mappingDialogTitle = computed(() => {
    const typeLabel =
      mappingForm.value.type === 'expense'
        ? '支出'
        : mappingForm.value.type === 'income'
          ? '收入'
          : '资产'
    const action = mappingDialog.value.mode === 'edit' ? '编辑' : '新增'
    return `${action}${typeLabel}映射`
  })

  let reparseAfterSave: ((key: string, type: MappingType) => Promise<void>) | null = null

  const checkAuth = (requireAuth?: () => boolean): boolean => {
    if (requireAuth && !requireAuth()) {
      ElMessage.info('未认证，请登录后重试')
      return false
    }
    return true
  }

  const openForCreate = <T>(options: OpenMappingOptions<T>) => {
    if (!checkAuth(options.requireAuth)) return

    const defaults = options.getCreateDefaults(options.row)
    mappingForm.value = {
      type: defaults.type,
      key: defaults.key,
      accountId: null,
      party: defaults.party,
      tag_ids: []
    }
    mappingDialog.value = {
      visible: true,
      loading: false,
      mode: 'create',
      mappingId: null
    }
    reparseAfterSave = options.onReparse
  }

  const openForEdit = async <T>(options: OpenMappingOptions<T>) => {
    const key = options.getSelectedKey(options.row)?.trim()
    if (!key) return
    if (!checkAuth(options.requireAuth)) return

    const type = options.inferType(options.row)
    reparseAfterSave = options.onReparse

    mappingDialog.value.loading = true
    mappingDialog.value.visible = true

    try {
      const mapping = await fetchMappingByKey(type, key)
      if (mapping) {
        mappingForm.value = {
          type,
          key: mapping.key,
          accountId: accountIdFromMapping(mapping, type),
          party: partyFromMapping(mapping, type),
          tag_ids: tagIdsFromMapping(mapping)
        }
        mappingDialog.value = {
          visible: true,
          loading: false,
          mode: 'edit',
          mappingId: mapping.id
        }
      } else {
        const templateItem = await fetchOfficialTemplateItemByKey(type, key)
        if (templateItem) {
          ElMessage.info('将基于官方模板创建个人映射')
          const accountId = await resolveAccountIdByPath(templateItem.account)
          mappingForm.value = {
            type,
            key: templateItem.key,
            accountId,
            party: type === 'expense' ? (templateItem.payee ?? '') : (templateItem.payer ?? ''),
            tag_ids: []
          }
        } else {
          ElMessage.info('未找到映射，将创建新映射')
          mappingForm.value = {
            type,
            key,
            accountId: null,
            party: '',
            tag_ids: []
          }
        }
        mappingDialog.value = {
          visible: true,
          loading: false,
          mode: 'create',
          mappingId: null
        }
      }
    } catch {
      ElMessage.error('加载映射失败')
      mappingDialog.value.visible = false
    } finally {
      mappingDialog.value.loading = false
    }
  }

  const openEditCurrentMapping = <T>(options: OpenMappingOptions<T>) => {
    void openForEdit(options)
  }

  const handleMappingSubmit = async () => {
    if (!mappingFormRef.value) return

    try {
      await mappingFormRef.value.validate()
    } catch {
      return
    }

    if (!reparseAfterSave) return

    mappingDialog.value.loading = true
    const { type, key, accountId, party, tag_ids } = mappingForm.value
    const selectedKey = key.trim()

    try {
      if (mappingDialog.value.mode === 'edit' && mappingDialog.value.mappingId != null) {
        if (type === 'expense') {
          await axios.put(`expense/${mappingDialog.value.mappingId}/`, {
            key: selectedKey,
            expend_id: accountId,
            payee: party,
            currency: 'CNY',
            tag_ids
          })
        } else if (type === 'income') {
          await axios.put(`income/${mappingDialog.value.mappingId}/`, {
            key: selectedKey,
            income_id: accountId,
            payer: party,
            tag_ids
          })
        } else {
          await axios.put(`assets/${mappingDialog.value.mappingId}/`, {
            key: selectedKey,
            assets_id: accountId,
            tag_ids
          })
        }
        ElMessage.success('映射更新成功')
      } else {
        if (type === 'expense') {
          await axios.post('/expense/', {
            key: selectedKey,
            expend_id: accountId,
            payee: party,
            currency: 'CNY',
            tag_ids
          })
        } else if (type === 'income') {
          await axios.post('/income/', {
            key: selectedKey,
            income_id: accountId,
            payer: party,
            tag_ids
          })
        } else {
          await axios.post('/assets/', {
            key: selectedKey,
            assets_id: accountId,
            tag_ids
          })
        }
        ElMessage.success('映射创建成功')
      }

      try {
        await reparseAfterSave(selectedKey, type)
        ElMessage.success('重解析完成')
        mappingDialog.value.visible = false
      } catch (reparseError: unknown) {
        const err = reparseError as { response?: { data?: { error?: string } } }
        ElMessage.error(err.response?.data?.error || '重新解析失败，请手动重试')
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { non_field_errors?: string[]; error?: string } }
      }
      if (err.response?.status === 400 && err.response.data?.non_field_errors) {
        ElMessage.error(err.response.data.non_field_errors[0])
      } else if (err.response?.status === 401) {
        ElMessage.info('未认证，请登录后重试')
      } else if (err.response?.status === 403) {
        ElMessage.info('权限不足，请登录后重试')
      } else {
        ElMessage.error(
          err.response?.data?.error ||
            (mappingDialog.value.mode === 'edit' ? '更新映射失败' : '创建映射失败')
        )
      }
    } finally {
      mappingDialog.value.loading = false
    }
  }

  return {
    mappingFormRef,
    mappingDialog,
    mappingForm,
    mappingRules,
    mappingDialogTitle,
    mappingPartyLabel,
    openForCreate,
    openForEdit,
    openEditCurrentMapping,
    handleMappingSubmit
  }
}
