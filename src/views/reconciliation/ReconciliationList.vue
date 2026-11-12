<template>
  <div class="reconciliation-list">
    <!-- 极简头部：只显示待办数量 -->
    <div class="list-header">
      <div class="header-info">
        <h2 class="header-title">待办列表</h2>
      </div>
      <!-- 筛选按钮 -->
      <div class="filter-buttons">
        <el-button :type="filterType === 'reconciliation' ? 'primary' : 'default'"
          @click="filterType = 'reconciliation'" class="filter-button">
          <span class="button-text">对账</span>
          <el-badge v-if="reconciliationCount > 0" :value="formatBadgeValue(reconciliationCount)"
            :type="filterType === 'reconciliation' ? 'danger' : 'info'" class="filter-badge" />
        </el-button>
        <el-button :type="filterType === 'entry_review' ? 'primary' : 'default'" @click="filterType = 'entry_review'"
          class="filter-button">
          <span class="button-text">审核</span>
          <el-badge v-if="entryReviewCount > 0" :value="formatBadgeValue(entryReviewCount)"
            :type="filterType === 'entry_review' ? 'danger' : 'info'" class="filter-badge" />
        </el-button>
        <el-button :type="recurringButtonType" @click="handleRecurringClick" class="filter-button"
          :title="filterType === 'recurring' && !recurringManageMode ? '再次点击进入管理' : '查看循环待办'">
          <span class="button-text">{{ recurringManageMode ? '循环 · 管理' : '循环' }}</span>
          <el-badge v-if="!recurringManageMode && recurringCount > 0" :value="formatBadgeValue(recurringCount)"
            :type="filterType === 'recurring' ? 'danger' : 'info'" class="filter-badge" />
        </el-button>
      </div>
    </div>

    <!-- 循环待办 · 管理视图（就地增删改，不跳页） -->
    <div v-if="filterType === 'recurring' && recurringManageMode" v-loading="definitionsLoading"
      class="recurring-manage">
      <div class="manage-toolbar">
        <el-button type="primary" @click="createDialogVisible = true">＋ 新建循环待办</el-button>
      </div>

      <div v-if="definitions.length === 0" class="empty-state">
        <p class="empty-text">还没有循环待办</p>
        <p class="empty-hint">点击「新建循环待办」填写周期、内容与日期</p>
      </div>

      <div v-else class="recurring-rows">
        <div v-for="defn in definitions" :key="defn.id" class="recurring-row">
          <div class="recurring-row-main">
            <el-input v-if="drafts[defn.id].kind === 'notify'" v-model="drafts[defn.id].note" class="row-note-input"
              maxlength="128" placeholder="内容（待办卡片文本）" @blur="saveNote(defn)" @keyup.enter="saveNote(defn)" />
            <div class="row-rule-input">
              <RecurrenceRuleInput v-model="drafts[defn.id].rule_text" :show-preview="false" @blur="saveRule(defn)"
                @submit="saveRule(defn)" />
            </div>
            <el-select v-model="drafts[defn.id].kind" class="row-kind-select" @change="saveKind(defn)">
              <el-option label="通知" value="notify" />
              <el-option label="生成审核待办" value="generate_review" />
            </el-select>
            <div class="row-date">
              <el-date-picker v-if="dateEditable(defn)" :model-value="defn.next_run_date || undefined"
                @update:model-value="(value: string) => handleStartDateChange(defn, value)" type="date"
                format="YYYY-MM-DD" value-format="YYYY-MM-DD" :clearable="false" placeholder="选择日期" class="date-picker"
                placement="bottom-start" :teleported="true" :popper-options="datePickerPopperOptions" />
              <span v-else class="row-next" title="本次待办完成后的下一次待办生成日期">{{ defn.next_run_date || '—' }}</span>
            </div>
            <div class="row-actions">
              <el-button size="small" text type="danger" @click="handleDelete(defn)">删除</el-button>
            </div>
          </div>
          <div v-if="drafts[defn.id].kind === 'generate_review'" class="recurring-row-template">
            <el-input v-model="drafts[defn.id].template" type="textarea" :rows="4" class="row-template-input"
              placeholder="固定模板将原样生成审核条目；日期等随期变化的内容请在审核页手动修改" @blur="saveTemplate(defn)" />
          </div>
        </div>
      </div>

      <RecurringTaskCreateDialog v-model="createDialogVisible" @created="handleCreated" />
    </div>

    <!-- 待办列表：大卡片设计 -->
    <div v-else v-loading="loading" class="tasks-container">
      <!-- 空状态：引导设置 -->
      <div v-if="tasks.length === 0" class="empty-state">
        <el-empty description="暂无待办">
          <template #image>
            <el-icon :size="80" color="var(--el-color-info)">
              <Check />
            </el-icon>
          </template>
          <template #description>
            <p class="empty-text" v-if="filterType === 'reconciliation'">所有账户都已对账完成</p>
            <p class="empty-text" v-else-if="filterType === 'entry_review'">暂无条目审核待办</p>
            <p class="empty-text" v-else-if="filterType === 'recurring'">暂无循环待办</p>
            <p class="empty-text" v-else>暂无待办</p>
            <p class="empty-hint" v-if="filterType === 'reconciliation'">在「账户管理」中设置对账周期，系统会自动创建待办</p>
            <p class="empty-hint" v-else-if="filterType === 'entry_review'">在「文件管理」中上传并解析文件，解析完成后条目会进入统一的条目审核待办</p>
            <p class="empty-hint" v-else-if="filterType === 'recurring'">再次点击「循环」进入管理，即可新建循环待办</p>
          </template>
        </el-empty>
      </div>

      <!-- 循环待办（通知）：条目 / 行式清单 -->
      <div v-else-if="filterType === 'recurring'" class="recurring-task-list">
        <div v-for="task in tasks" :key="task.id" class="recurring-task-row">
          <button type="button" class="task-checkbox" :disabled="completingTaskIds.has(task.id)" title="标记完成"
            @click="handleCompleteRecurring(task)" />
          <div class="row-title" :title="task.recurring_label || '循环待办'">
            {{ task.recurring_label || '循环待办' }}
          </div>
          <div class="date-info row-date" @click.stop>
            <el-date-picker :model-value="task.scheduled_date || undefined"
              @update:model-value="(value: string) => handleDateChange(task.id, value)" type="date" format="YYYY-MM-DD"
              value-format="YYYY-MM-DD" :clearable="false" placeholder="选择日期" class="date-picker no-border-date-picker"
              placement="bottom-start" :teleported="true" :popper-options="datePickerPopperOptions" />
          </div>
          <span v-if="task.next_run_date" class="row-next-date" title="本次待办完成后的下一次待办生成日期">
            <el-icon>
              <RefreshRight />
            </el-icon>
            {{ task.next_run_date }}
          </span>
          <el-tag v-if="task.scheduled_date && isOverdue(task.scheduled_date)" type="danger" size="small"
            class="overdue-tag">
            逾期
          </el-tag>
        </div>
      </div>

      <!-- 待办卡片列表（对账 / 条目审核） -->
      <div v-else class="tasks-grid">
        <div v-for="task in tasks" :key="task.id" class="task-card" :class="{ 'task-overdue': isTaskOverdue(task) }"
          @click="handleStart(task)">
          <!-- 卡片主体 -->
          <div class="card-main">
            <!-- 对账待办：显示账户名称和日期选择器 -->
            <template v-if="task.task_type === 'reconciliation'">
              <div class="account-name">
                {{ task.account_name || '未知账户' }}
              </div>
              <div class="date-info" @click.stop>
                <el-date-picker :model-value="task.scheduled_date || undefined"
                  @update:model-value="(value: string) => handleDateChange(task.id, value)" type="date"
                  format="YYYY-MM-DD" value-format="YYYY-MM-DD" :clearable="false" placeholder="选择日期"
                  class="date-picker no-border-date-picker" placement="bottom-start" :teleported="true"
                  :popper-options="datePickerPopperOptions" />
                <el-tag v-if="task.scheduled_date && isOverdue(task.scheduled_date)" type="danger" size="small"
                  class="overdue-tag">
                  逾期
                </el-tag>
              </div>
            </template>

            <!-- 条目审核待办：显示条目数和剩余时间 -->
            <template v-else-if="task.task_type === 'entry_review'">
              <div class="file-name">
                条目审核
              </div>
              <div class="entry-count">
                共 {{ task.entry_count ?? 0 }} 条待审核条目
              </div>
              <div class="parse-review-footer">
                <div class="remaining-time">
                  {{ getRemainingTime(task) }}
                </div>
                <div class="card-actions" @click.stop>
                  <el-button type="primary" size="small" :loading="writingTaskIds.has(task.id)"
                    :disabled="isReviewExpired(task)" @click="handleDirectWrite(task)" class="direct-write-btn">
                    跳过
                  </el-button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onActivated, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Check,
  RefreshRight
} from '@element-plus/icons-vue'
import { getTasks, updateTask, completeTask } from '../../api/reconciliation'
import { confirmWrite } from '../../api/parse-review'
import {
  listRecurringTasks,
  updateRecurringTask,
  deleteRecurringTask
} from '../../api/recurring'
import RecurrenceRuleInput from '../../components/recurrence/RecurrenceRuleInput.vue'
import RecurringTaskCreateDialog from '../../components/recurrence/RecurringTaskCreateDialog.vue'
import type { ScheduledTask, RecurringTask, RecurringKind } from '../../types/reconciliation'
import { isReviewExpired } from '../../types/reconciliation'
import { emitTaskBannerRefresh } from '../../utils/accountEvents'
import { extractApiErrorMessage } from '../../utils/errorHelper'

const router = useRouter()

const loading = ref(false)
const tasks = ref<ScheduledTask[]>([])
const total = ref(0)
const reconciliationCount = ref(0)
const entryReviewCount = ref(0)
const recurringCount = ref(0)
const filterType = ref<'reconciliation' | 'entry_review' | 'recurring'>('entry_review')
const writingTaskIds = ref<Set<number>>(new Set())
const completingTaskIds = ref<Set<number>>(new Set())

// 循环待办管理视图状态
const recurringManageMode = ref(false)
const definitions = ref<RecurringTask[]>([])
const definitionsLoading = ref(false)
const createDialogVisible = ref(false)
// 行内编辑草稿（按定义 id）；内容/规则/模板失焦或回车自动保存
const drafts = reactive<Record<number, { note: string; rule_text: string; kind: RecurringKind; template: string }>>({})

onMounted(async () => {
  // 动态注入样式，确保清除日期选择器的边框
  injectDatePickerStyles()
  // 先加载数量，然后根据数量决定默认显示哪个分类
  await loadCounts()
  // 如果条目审核待办不存在，则显示对账待办
  if (entryReviewCount.value === 0 && reconciliationCount.value > 0) {
    filterType.value = 'reconciliation'
  }
  await loadTasks()
})

// 页面激活时刷新列表（从对账表单或条目审核详情返回时）
onActivated(async () => {
  await loadCounts()
  await loadTasks()
  // 触发横幅更新，确保能检测到任务数量变化（用于导览步骤5）
  emitTaskBannerRefresh()
})

// 监听筛选类型变化
watch(filterType, () => {
  if (filterType.value !== 'recurring') {
    recurringManageMode.value = false
  }
  loadTasks()
})

// 动态注入样式清除日期选择器边框
function injectDatePickerStyles() {
  const styleId = 'reconciliation-date-picker-no-border'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .reconciliation-list .date-info .date-picker .el-input__wrapper,
    .reconciliation-list [class*="el-input__wrapper"],
    .reconciliation-list [class*="el-input__wrapper"] {
      border: none !important;
      border-width: 0 !important;
      border-style: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
      outline: none !important;
      outline-width: 0 !important;
      background-color: transparent !important;
    }
    .reconciliation-list .date-info .date-picker .el-input__wrapper::before,
    .reconciliation-list .date-info .date-picker .el-input__wrapper::after,
    .reconciliation-list .date-info .date-picker .el-input__wrapper::before,
    .reconciliation-list .date-info .date-picker .el-input__wrapper::after {
      display: none !important;
      content: none !important;
      border: none !important;
      box-shadow: none !important;
    }
    .reconciliation-list .date-info .date-picker .el-date-editor,
    .reconciliation-list .date-info .date-picker .el-date-editor {
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      background: transparent !important;
    }
  `
  document.head.appendChild(style)
}

// 加载各分类的数量
async function loadCounts() {
  try {
    // 加载对账待办数量
    const reconciliationParams = {
      status: 'pending',
      task_type: 'reconciliation',
      due: true
    }
    const reconciliationResponse = await getTasks(reconciliationParams)
    const reconciliationData = reconciliationResponse.data
    if (Array.isArray(reconciliationData)) {
      reconciliationCount.value = reconciliationData.length
    } else if (reconciliationData && typeof reconciliationData === 'object' && 'count' in reconciliationData) {
      reconciliationCount.value = (reconciliationData as { count: number }).count || 0
    }

    // 加载条目审核待办数量
    const entryReviewParams = {
      status: 'pending',
      task_type: 'entry_review'
    }
    const entryReviewResponse = await getTasks(entryReviewParams)
    const entryReviewData = entryReviewResponse.data
    if (Array.isArray(entryReviewData)) {
      entryReviewCount.value = entryReviewData.length
    } else if (entryReviewData && typeof entryReviewData === 'object' && 'count' in entryReviewData) {
      entryReviewCount.value = (entryReviewData as { count: number }).count || 0
    }

    // 加载循环待办数量（仅统计到期项）
    const recurringResponse = await getTasks({
      status: 'pending',
      task_type: 'recurring',
      due: true
    })
    const recurringData = recurringResponse.data
    if (Array.isArray(recurringData)) {
      recurringCount.value = recurringData.length
    } else if (recurringData && typeof recurringData === 'object' && 'count' in recurringData) {
      recurringCount.value = (recurringData as { count: number }).count || 0
    }
  } catch (error: unknown) {
    console.error('加载待办数量错误:', error)
    // 静默失败，不影响主流程
    // 401 错误由 loadTasks 统一处理，避免重复提示
  }
}

async function loadTasks() {
  loading.value = true
  try {
    const params: {
      due?: boolean
      status: string
      task_type: string
    } = {
      status: 'pending',
      task_type: filterType.value
    }

    // 条目审核待办不需要 due 筛选；对账/循环待办使用 due=true
    if (filterType.value === 'reconciliation' || filterType.value === 'recurring') {
      params.due = true
    }

    const response = await getTasks(params)

    const data = response.data
    if (Array.isArray(data)) {
      tasks.value = data as ScheduledTask[]
      total.value = data.length
    } else if (data && typeof data === 'object' && 'results' in data) {
      tasks.value = (data as { results: ScheduledTask[], count: number }).results || []
      total.value = (data as { results: ScheduledTask[], count: number }).count || 0
    } else {
      console.error('未知的响应结构:', data)
      tasks.value = []
      total.value = 0
    }

    // 更新对应分类的数量
    if (filterType.value === 'reconciliation') {
      reconciliationCount.value = total.value
    } else if (filterType.value === 'entry_review') {
      entryReviewCount.value = total.value
    } else if (filterType.value === 'recurring') {
      recurringCount.value = total.value
    }
  } catch (error: unknown) {
    console.error('加载待办列表错误:', error)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number, data?: { message?: string } } }
      const status = axiosError.response?.status

      if (status === 401) {
        ElMessage.info('未认证，请登录后重试')
      } else {
        const message = axiosError.response?.data?.message || '加载待办列表失败'
        ElMessage.error(message)
      }
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

// 日期选择器弹层定位（对账 / 循环卡片共用）
const datePickerPopperOptions = {
  modifiers: [
    { name: 'offset', options: { offset: [0, 4] } },
    { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
    { name: 'computeStyles', options: { adaptive: true, roundOffsets: true } }
  ]
}

function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return date < today
}

// 对账 / 循环待办卡片：到期待办高亮
function isTaskOverdue(task: ScheduledTask): boolean {
  if (task.task_type !== 'reconciliation' && task.task_type !== 'recurring') return false
  return !!task.scheduled_date && isOverdue(task.scheduled_date)
}

function handleStart(task: ScheduledTask) {
  // 循环待办仅提示，卡片不跳转
  if (task.task_type === 'recurring') {
    return
  }
  if (task.task_type === 'entry_review') {
    if (isReviewExpired(task)) {
      ElMessage.warning('条目审核待办已过期，系统将自动写入')
      return
    }
    router.push('/entry-review')
  } else {
    router.push(`/tasks/${task.id}`)
  }
}

// 完成循环待办实例（点击复选框直接完成，无二次确认）
async function handleCompleteRecurring(task: ScheduledTask) {
  if (task.task_type !== 'recurring') return
  if (completingTaskIds.value.has(task.id)) return

  completingTaskIds.value.add(task.id)
  try {
    await completeTask(task.id)
    await loadTasks()
    await loadCounts()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { message?: string } } }
      ElMessage.error(axiosError.response?.data?.message || '完成循环待办失败')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  } finally {
    completingTaskIds.value.delete(task.id)
  }
}

// 计算剩余时间（基于 review_expires_at；为空表示长期有效）
function getRemainingTime(task: ScheduledTask): string {
  if (task.review_expires_at === null || task.review_expires_at === undefined) {
    // 空值表示「长期有效」（如仅含循环待办来源：永不过期、不自动写入）
    return '长期有效'
  }

  const expiryTime = task.review_expires_at * 1000
  const remainingMs = expiryTime - Date.now()

  if (remainingMs <= 0) {
    return '已过期，等待自动写入'
  }

  const remainingHours = Math.floor(remainingMs / (3600 * 1000))
  const remainingMinutes = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000))

  if (remainingHours > 0) {
    return `${remainingHours}小时${remainingMinutes}分钟`
  } else {
    return `${remainingMinutes}分钟`
  }
}

// 格式化 badge 显示值（超过 99 显示 99+）
function formatBadgeValue(count: number): string {
  return count > 99 ? '99+' : String(count)
}

async function handleDateChange(taskId: number, newDate: string) {
  if (!newDate) return

  // 找到对应的任务并保存原值
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return

  const originalDate = task.scheduled_date

  try {
    await updateTask(taskId, {
      scheduled_date: newDate
    })
    ElMessage.success('修改日期成功')
    // 刷新列表以更新逾期状态
    loadTasks()
  } catch (error: unknown) {
    // 失败时恢复原值
    if (task) {
      task.scheduled_date = originalDate
    }
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { message?: string } } }
      ElMessage.error(axiosError.response?.data?.message || '修改日期失败')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  }
}

// 跳过审核直接写入
async function handleDirectWrite(task: ScheduledTask) {
  if (task.task_type !== 'entry_review') return
  if (isReviewExpired(task)) {
    ElMessage.warning('条目审核待办已过期，系统将自动写入')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要跳过审核，直接将全部待审核条目写入账本吗？`,
      '确认直接写入',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    writingTaskIds.value.add(task.id)

    try {
      await confirmWrite()
      ElMessage.success('已直接写入账本')

      // 刷新列表
      await loadTasks()
      await loadCounts()

      // 触发横幅更新
      emitTaskBannerRefresh()
    } finally {
      writingTaskIds.value.delete(task.id)
    }
  } catch (error: unknown) {
    if (error === 'cancel') {
      // 用户取消，不处理
      return
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: { message?: string } } }
      ElMessage.error(axiosError.response?.data?.message || '直接写入失败')
    } else {
      ElMessage.error('网络错误，请稍后重试')
    }
  }
}

// ---- 循环待办：管理视图 ----

// 单个「循环」按钮的视觉状态：未选中 / 待办视图 / 管理视图
const recurringButtonType = computed<'primary' | 'warning' | 'default'>(() => {
  if (filterType.value !== 'recurring') return 'default'
  return recurringManageMode.value ? 'warning' : 'primary'
})

// 合并按钮：首次点击看待办，再次点击进管理，管理态再点返回待办
function handleRecurringClick() {
  if (filterType.value !== 'recurring') {
    filterType.value = 'recurring'
    recurringManageMode.value = false
    return
  }
  if (!recurringManageMode.value) {
    recurringManageMode.value = true
    loadDefinitions()
    return
  }
  // 返回待办列表：重新拉取，确保管理中新生成/取消的待办立即展示
  recurringManageMode.value = false
  loadTasks()
}

async function loadDefinitions() {
  definitionsLoading.value = true
  try {
    const response = await listRecurringTasks()
    definitions.value = Array.isArray(response.data) ? response.data : []
    syncDrafts()
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '加载循环待办失败'))
  } finally {
    definitionsLoading.value = false
  }
}

// 为缺少草稿的定义补齐初值（不覆盖正在编辑的草稿）
function syncDrafts() {
  for (const defn of definitions.value) {
    if (!drafts[defn.id]) {
      drafts[defn.id] = {
        note: defn.note,
        rule_text: defn.rule_text,
        kind: defn.kind,
        template: defn.template,
      }
    }
  }
}

// 日期可编辑：仅当该定义尚未生成待办（存在待执行实例时，日期表示「完成后下一次日期」只读）
function dateEditable(defn: RecurringTask): boolean {
  return !defn.has_pending
}

function revertDraft(defn: RecurringTask, field: 'note' | 'rule_text') {
  const d = drafts[defn.id]
  if (d) d[field] = defn[field]
}

async function saveNote(defn: RecurringTask) {
  const d = drafts[defn.id]
  const note = (d?.note || '').trim()
  if (note === defn.note) return

  try {
    await updateRecurringTask(defn.id, { note })
    if (d) d.note = note
    defn.note = note
    ElMessage.success('已保存')
    await loadDefinitions()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    revertDraft(defn, 'note')
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '保存失败'))
  }
}

async function saveRule(defn: RecurringTask) {
  const d = drafts[defn.id]
  const rule = (d?.rule_text || '').trim()
  if (!rule) {
    ElMessage.warning('循环规则不能为空')
    revertDraft(defn, 'rule_text')
    return
  }
  if (rule === defn.rule_text) return

  try {
    await updateRecurringTask(defn.id, { rule_text: rule })
    if (d) d.rule_text = rule
    defn.rule_text = rule
    ElMessage.success('已保存')
    await loadDefinitions()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    revertDraft(defn, 'rule_text')
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '保存失败，请检查循环规则'))
  }
}

async function saveKind(defn: RecurringTask) {
  const d = drafts[defn.id]
  const kind = d?.kind ?? defn.kind
  if (kind === defn.kind) return

  // 切到「生成审核待办」但模板为空：先展开模板编辑区，待填写后再自动保存
  if (kind === 'generate_review' && !(d?.template || '').trim()) {
    ElMessage.info('请先在该行下方填写模板，失焦后自动保存')
    return
  }

  try {
    await updateRecurringTask(defn.id, { kind, template: d?.template ?? '' })
    defn.kind = kind
    ElMessage.success('已保存')
    await loadDefinitions()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    if (d) d.kind = defn.kind
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '保存失败'))
  }
}

async function saveTemplate(defn: RecurringTask) {
  const d = drafts[defn.id]
  const template = d?.template ?? ''
  const kind = d?.kind ?? defn.kind
  if (template === defn.template && kind === defn.kind) return
  if (kind === 'generate_review' && !template.trim()) {
    ElMessage.warning('生成审核待办时模板不能为空')
    return
  }

  try {
    // 一并提交 kind：覆盖「先切换类型、再补模板」的延迟保存
    await updateRecurringTask(defn.id, { kind, template })
    defn.template = template
    defn.kind = kind
    ElMessage.success('已保存')
    await loadDefinitions()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    // 保存失败时保留草稿与模板编辑区，便于重试
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '保存失败'))
  }
}

async function handleStartDateChange(defn: RecurringTask, value: string) {
  if (!value || value === defn.next_run_date) return
  try {
    await updateRecurringTask(defn.id, { start_date: value })
    ElMessage.success('已修改生成日期')
    await loadDefinitions()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '修改生成日期失败'))
  }
}

// 新建成功：刷新定义列表与全局横幅
async function handleCreated() {
  await loadDefinitions()
  emitTaskBannerRefresh()
}

// 定义展示标签（无标题：取内容首行，回退规则文本）
function defnLabel(defn: RecurringTask): string {
  const note = (defn.note || '').trim()
  if (note) return note.split('\n')[0].slice(0, 128)
  const template = (defn.template || '').trim()
  if (template) return template.split('\n')[0].slice(0, 128)
  return defn.rule_text
}

async function handleDelete(defn: RecurringTask) {
  try {
    await ElMessageBox.confirm(`确定要删除循环待办「${defnLabel(defn)}」吗？`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await deleteRecurringTask(defn.id)
    ElMessage.success('删除成功')
    await loadDefinitions()
    emitTaskBannerRefresh()
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown } }
    ElMessage.error(extractApiErrorMessage(axiosError.response?.data, '删除失败'))
  }
}
</script>

<style scoped lang="scss">
.reconciliation-list {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;

  .list-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;

    .reconciliation-sub-filter {
      flex-basis: 100%;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .header-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        margin: 0;
      }

      .badge-count {
        :deep(.el-badge__content) {
          font-size: 12px;
          font-weight: 600;
        }
      }
    }

    .filter-buttons {
      display: flex;
      gap: 12px;

      .filter-button {
        position: relative;
        padding: 8px 20px;
        min-width: 80px;
        transition: all 0.3s ease;

        .button-text {
          display: inline-block;
          position: relative;
          z-index: 1;
        }

        .filter-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          z-index: 2;
          transform: scale(1);
          transition: transform 0.2s ease;

          :deep(.el-badge__content) {
            font-size: 11px;
            font-weight: 700;
            height: 20px;
            line-height: 20px;
            padding: 0 7px;
            min-width: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            border: 2px solid var(--el-bg-color);
            letter-spacing: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          }

          // 悬停时轻微放大
          &:hover {
            transform: scale(1.1);
          }
        }

        // 按钮悬停时 badge 也跟随变化
        &:hover {
          .filter-badge {
            transform: scale(1.1);
          }
        }

        // 激活状态下的 badge 样式
        &.el-button--primary {
          .filter-badge {
            :deep(.el-badge__content) {
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
              animation: pulse 2s ease-in-out infinite;
            }
          }
        }
      }
    }
  }

  .tasks-container {
    min-height: 400px;
  }

  .recurring-manage {
    min-height: 200px;

    .manage-toolbar {
      margin-bottom: 16px;
    }

    .recurring-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .recurring-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 16px;
      background: var(--el-bg-color);
      border: 2px solid var(--el-border-color);
      border-radius: 12px;
      transition: border-color 0.2s;

      &:hover {
        border-color: var(--el-color-primary);
      }

      .recurring-row-main {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .row-kind-select {
        width: 140px;
        flex-shrink: 0;
      }

      .row-note-input {
        width: 200px;
        flex-shrink: 0;
      }

      .row-rule-input {
        flex: 1;
        min-width: 0;
      }

      .row-date {
        flex-shrink: 0;
        width: 130px;
        display: flex;
        align-items: center;

        // 可修改态（下一次待办生成日期）：去掉边框与日历图标，
        // 外观与只读态保持一致，仅日期颜色不同
        // 注意：直接命中 EP 自带类名（不依赖 .date-picker 是否落在触发元素上）
        :deep(.el-date-editor) {
          width: 130px;
        }

        :deep(.el-input__prefix),
        :deep(.el-input__prefix-inner),
        :deep([class*="input__prefix"]) {
          display: none !important;
        }

        :deep(.el-input__wrapper) {
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }

        :deep(.el-input__inner) {
          padding: 0 !important;
          font-size: 14px;
          font-family: inherit;
          text-align: left;
          color: var(--el-color-primary);
        }

        // 只读态（本次待办完成后的下一次待办生成日期）：
        // 与可修改态同位置、同字体，仅颜色不同
        .row-next {
          font-size: 14px;
          font-family: inherit;
          line-height: 1.5;
          white-space: nowrap;
          color: var(--el-text-color-secondary);
        }
      }

      .row-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .recurring-row-template {
        .row-template-input {
          width: 100%;

          :deep(.el-textarea__inner),
          :deep(.el-textarea__inner) {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
          }
        }
      }
    }
  }

  // 循环待办（通知）：条目 / 行式清单（参考 Obsidian Tasks 的待办样式）
  .recurring-task-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .recurring-task-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--el-fill-color);
    }

    // 正方形复选框：点击即完成（无二次确认）
    .task-checkbox {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      padding: 0;
      border: 1.5px solid var(--el-text-color-secondary);
      border-radius: 3px;
      background: transparent;
      cursor: pointer;
      transition: border-color 0.15s, background-color 0.15s;

      &:hover:not(:disabled) {
        border-color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-9);
      }

      &:disabled {
        cursor: default;
        opacity: 0.5;
      }
    }

    .row-title {
      min-width: 0;
      font-size: 14px;
      color: var(--el-text-color-primary);
      word-break: break-word;
      transition: color 0.2s;
    }

    .row-date {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      max-width: none;
      width: auto;

      :deep(.el-input__inner),
      :deep(.el-input__inner) {
        font-size: 14px;
      }
    }

    .row-next-date {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }
  }

  .empty-state {
    padding: 80px 20px;
    text-align: center;

    .empty-text {
      font-size: 16px;
      color: var(--el-text-color-primary);
      margin: 16px 0 8px;
    }

    .empty-hint {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin: 0;
    }
  }

  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .date-info.completed-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;

    .completed-date {
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }

    .revoke-btn {
      margin-top: 4px;
    }
  }

  .task-card {
    position: relative;
    background: var(--el-bg-color);
    border: 2px solid var(--el-border-color);
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    overflow: hidden;

    // 确保日期选择器弹出面板不被裁剪
    .date-info {
      overflow: visible;
      position: relative;
      z-index: 1;
    }

    &:hover {
      border-color: var(--el-color-primary);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    &.task-overdue {
      border-color: var(--el-color-danger);
      background: linear-gradient(135deg,
          var(--el-bg-color) 0%,
          rgba(245, 108, 108, 0.05) 100%);

      .account-name,
      .file-name {
        color: var(--el-color-danger);
      }
    }

    .card-main {
      flex: 1;
      min-width: 0;
    }

    .account-name,
    .file-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 12px;
      word-break: break-word;
      transition: color 0.2s;
    }

    .remaining-time {
      font-size: 14px;
      color: var(--el-text-color-regular);
      margin-top: 4px;
    }

    .entry-count {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }

    .parse-review-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      .direct-write-btn {
        font-size: 13px;
        padding: 6px 16px;
        height: 28px;
        border-radius: 6px;
        transition: all 0.2s ease;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      }
    }

    .date-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: var(--el-text-color-regular);
      margin-top: 4px;
      max-width: 240px;
      width: fit-content;

      .date-picker {
        width: 120px;
        flex-shrink: 0;

        // 清除所有边框和阴影
        :deep(.el-input__wrapper),
        :deep([class*="input__wrapper"]) {
          padding: 4px 8px !important;
          box-shadow: none !important;
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          outline: none !important;
          background-color: transparent !important;
          transition: all 0.2s;

          // 清除所有伪元素（可能用于创建边框效果）
          &::before,
          &::after {
            display: none !important;
            content: none !important;
            border: none !important;
            border-width: 0 !important;
            box-shadow: none !important;
            background: none !important;
          }

          &:hover {
            background-color: var(--el-fill-color) !important;
            border: none !important;
            border-width: 0 !important;
            box-shadow: none !important;
            outline: none !important;
          }

          &.is-focus,
          &[class*="is-focus"] {
            background-color: var(--el-fill-color) !important;
            border: none !important;
            border-width: 0 !important;
            box-shadow: none !important;
            outline: none !important;
          }
        }

        // 清除输入框内部边框
        :deep(.el-input__inner),
        :deep(.el-input__inner) {
          font-family: 'Courier New', monospace;
          font-weight: 500;
          font-size: 14px;
          color: var(--el-text-color-regular);
          text-align: left;
          border: none !important;
          outline: none !important;
          background: transparent !important;
        }

        // 移除日期选择器右侧的图标
        :deep(.el-input__suffix),
        :deep(.el-input__suffix) {
          display: none !important;
        }

        // 清除整个输入框容器的边框
        :deep(.el-input),
        :deep(.el-input) {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          // width: 120px;
        }

        // 清除日期选择器外层容器的所有视觉效果
        :deep(.el-date-editor),
        :deep(.el-date-editor) {
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
          background: transparent !important;

          &::before,
          &::after {
            display: none !important;
            content: none !important;
          }
        }
      }

      .overdue-tag {
        margin-left: 4px;
        flex-shrink: 0;
      }
    }
  }
}

// Badge 脉冲动画（仅在激活状态）
@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}


// 响应式设计
@media (max-width: 768px) {
  .reconciliation-list {
    padding: 16px;

    .tasks-grid {
      grid-template-columns: 1fr;
    }

    .list-header {
      .filter-buttons {
        gap: 8px;

        .filter-button {
          padding: 6px 16px;
          min-width: 70px;
          font-size: 14px;

          .filter-badge {
            top: -4px;
            right: -4px;

            :deep(.el-badge__content) {
              font-size: 10px;
              height: 18px;
              line-height: 18px;
              padding: 0 6px;
              min-width: 18px;
              border-radius: 9px;
            }
          }
        }
      }
    }
  }
}
</style>

<!-- 非 scoped 样式，用于覆盖 Element Plus 默认样式 -->
<style lang="scss">
// 使用全局样式强制覆盖日期选择器的边框（使用更具体的选择器）
.reconciliation-list .date-info .no-border-date-picker,
.reconciliation-list .date-info .date-picker {
  width: 120px;

  // 直接选择所有可能的类名组合，不使用 :deep
  .el-input__wrapper,
  [class*="input__wrapper"] {
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    border-color: transparent !important;
    box-shadow: none !important;
    outline: none !important;
    outline-width: 0 !important;
    background-color: transparent !important;

    &::before,
    &::after {
      display: none !important;
      content: none !important;
      border: none !important;
      border-width: 0 !important;
      box-shadow: none !important;
      background: none !important;
    }
  }

  .el-date-editor,
  [class*="date-editor"] {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    background: transparent !important;

    &::before,
    &::after {
      display: none !important;
      content: none !important;
    }
  }

  // 使用属性选择器匹配所有可能的变体
  [class*="el-input"],
  [class*="el-input"] {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    // width: 120px;
  }

  // 强制清除所有子元素的边框和阴影
  * {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
}

// 更激进的全局覆盖：直接针对所有可能的类名
.reconciliation-list {

  [class*="el-input__wrapper"],
  [class*="el-input__wrapper"] {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
}

// 暗色模式适配
html.dark {
  .reconciliation-list {
    .filter-buttons {
      .filter-button {
        .filter-badge {

          .el-badge__content,
          [class*="badge__content"] {
            border-color: var(--el-bg-color-page) !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
          }
        }

        &.el-button--primary {
          .filter-badge {

            .el-badge__content,
            [class*="badge__content"] {
              border-color: var(--el-color-primary-dark-2) !important;
            }
          }
        }
      }
    }
  }
}
</style>
