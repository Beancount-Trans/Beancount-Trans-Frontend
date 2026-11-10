<template>
  <el-table v-if="entries.length > 0" :data="entries" row-key="uuid" style="width: 100%" border highlight-current-row>
    <el-table-column v-if="props.showSourceFile" label="来源账单" width="180" show-overflow-tooltip>
      <template #default="scope">
        <el-tag v-if="scope.row.source === 'copilot'" type="info" size="small">Copilot 记账</el-tag>
        <template v-else>
          {{ scope.row.file_name || (scope.row.file_id != null ? `文件 #${scope.row.file_id}` : '-') }}
        </template>
      </template>
    </el-table-column>
    <el-table-column label="Beancount 条目预览" min-width="400">
      <template #default="scope">
        <div :class="getEntryClasses(scope.row.uuid, scope.row.edited_formatted)">
          <template v-if="!isEntryTextEditMode(scope.row.uuid)">
            <div class="entry-preview-render" role="textbox" tabindex="0"
              @click="onEntryPreviewShellClick(scope.row, $event)"
              @keydown.enter.prevent="startTextEdit(scope.row.uuid)">
              <div v-for="(pline, li) in buildLineSegments(scope.row.edited_formatted)" :key="li"
                class="entry-preview-line">
                <template v-for="(seg, si) in pline.segments" :key="`${li}-${si}`">
                  <span v-if="seg.kind === 'tag'" class="entry-preview-tag-chip" @click.stop>
                    <el-tooltip placement="top" :show-after="200">
                      <template #content>
                        <div class="entry-preview-tag-tooltip">
                          <div v-for="(source, sidx) in getTagSourcesForPath(scope.row, seg.path)" :key="sidx"
                            class="entry-preview-tag-source-line">
                            <button v-if="source.type === 'mapping' && source.key" type="button"
                              class="entry-preview-tag-source-link"
                              @click.stop="openEditMappingForRowByKey(scope.row, source)">
                              {{ formatTagSourceLabel(source) }}
                            </button>
                            <span v-else>{{ formatTagSourceLabel(source) }}</span>
                          </div>
                        </div>
                      </template>
                      <span class="entry-preview-tag-link">{{ seg.text }}</span>
                    </el-tooltip>
                    <button type="button" class="entry-preview-tag-remove" aria-label="移除标签"
                      @click.stop="removeTagFromEntry(scope.row, seg.path)">
                      ×
                    </button>
                  </span>
                  <button v-else-if="seg.kind === 'account'" type="button" class="entry-preview-account-link"
                    @click.stop="openAccountAssistFromSegment(scope.row, seg, $event)">
                    {{ seg.text }}
                  </button>
                  <span v-else class="entry-preview-plain">{{ seg.text }}</span>
                </template>
                <button v-if="pline.isHeader" type="button" class="entry-preview-tag-add"
                  @click.stop="openTagAssist(scope.row, $event)">
                  + 标签
                </button>
              </div>
            </div>
          </template>
          <el-input v-else :ref="(el: unknown) => setEntryInputRef(scope.row.uuid, el)"
            v-model="scope.row.edited_formatted" type="textarea"
            :autosize="getEntryAutosize(scope.row.edited_formatted)" class="entry-preview"
            placeholder="编辑 Beancount 条目；失焦后返回预览。过账行中账户在预览模式下点击可更换" @blur="onEntryTextareaBlur(scope.row)"
            @input="clearTabCompleteSession(scope.row.uuid)" @keydown.tab="bindEntryPreviewTab(scope.row)" />
          <div v-if="errorEntries[scope.row.uuid]" class="validation-message error-message">
            {{ errorEntries[scope.row.uuid] }}
          </div>
          <div v-else-if="validationWarnings[scope.row.uuid]" class="validation-message warning-message">
            {{ validationWarnings[scope.row.uuid] }}
          </div>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="AI分类反馈" min-width="400">
      <template #default="scope">
        <div v-if="scope.row.source === 'copilot'" class="ai-classification-container">
          <div class="current-selection">
            <span class="label">分类反馈：</span>
            <span class="no-category-tip">Copilot 记账条目不支持重新解析，请直接编辑条目文本</span>
          </div>
        </div>
        <div v-else-if="isInstallmentRepaymentEntry(scope.row)" class="ai-classification-container">
          <div class="current-selection">
            <span class="label">分期还款：</span>
            <span class="no-category-tip">不参与分类反馈</span>
          </div>
        </div>
        <div v-else class="ai-classification-container">
          <div class="current-selection">
            <span class="label">{{ isNeutralParseReviewEntry(scope.row) ? '当前分类：' : '当前分类：' }}</span>
            <el-tag v-if="scope.row.selected_expense_key" type="success" class="selected-tag is-editable"
              @click="openEditCurrentMappingForRow(scope.row)">
              {{ scope.row.selected_expense_key }}
            </el-tag>
            <span v-else class="no-category-tip">{{ isNeutralParseReviewEntry(scope.row) ? '无分类建议' : '无分类建议' }}</span>
          </div>
          <div v-if="scope.row.expense_candidates_with_score && scope.row.expense_candidates_with_score.length > 0"
            class="candidates">
            <span class="label">候选分类：</span>
            <div class="candidate-tags">
              <el-tag v-for="(candidate, idx) in scope.row.expense_candidates_with_score" :key="idx"
                :type="candidate.key === scope.row.selected_expense_key ? 'success' : 'info'"
                :class="['candidate-tag', { 'is-selected': candidate.key === scope.row.selected_expense_key }]"
                @click="handleKeywordSelect(scope.row.uuid, candidate.key)">
                {{ candidate.key }}
                <span class="score" v-if="candidate.score !== undefined">
                  ({{ candidate.score }})
                </span>
              </el-tag>
              <el-button v-if="shouldShowParseReviewCreateMapping(scope.row)" size="small" plain
                @click="openCreateMappingForRow(scope.row)" class="add-mapping-btn">
                <el-icon>
                  <Plus />
                </el-icon> 新增映射
              </el-button>
            </div>
          </div>
          <div v-else class="candidates">
            <span class="label muted">无候选分类</span>
            <el-button v-if="shouldShowParseReviewCreateMapping(scope.row)" size="small" plain
              @click="openCreateMappingForRow(scope.row)" class="add-mapping-btn">
              <el-icon>
                <Plus />
              </el-icon> 新增映射
            </el-button>
          </div>
        </div>
      </template>
    </el-table-column>
  </el-table>

  <!-- 空状态 -->
  <el-empty v-else description="暂无解析结果" />

  <!-- 内联映射对话框（新增 / 编辑） -->
  <el-dialog v-model="mappingDialog.visible" :title="mappingDialogTitle" width="600px">
    <el-form :model="mappingForm" :rules="mappingRules" ref="mappingFormRef" label-width="100px">
      <el-form-item label="关键字" prop="key">
        <el-input v-model="mappingForm.key" placeholder="请输入关键字" />
      </el-form-item>
      <el-form-item label="映射账户" prop="accountId">
        <AccountSelector v-model="mappingForm.accountId" placeholder="请选择或搜索账户" />
      </el-form-item>
      <el-form-item v-if="mappingForm.type !== 'asset'" :label="mappingPartyLabel" prop="party">
        <el-input v-model="mappingForm.party"
          :placeholder="mappingForm.type === 'expense' ? '如腾讯、星巴克' : '选填：付款方信息'" />
      </el-form-item>
      <el-form-item label="标签" prop="tag_ids">
        <TagSelector v-model="mappingForm.tag_ids" multiple :show-preview="false" placeholder="请选择标签" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="mappingDialog.visible = false">取消</el-button>
      <el-button type="primary" @click="handleMappingSubmit" :loading="mappingDialog.loading">
        保存并重解析
      </el-button>
    </template>
  </el-dialog>

  <!-- 点击预览内账户：浮动选择器（Teleport 至 body，兼容 EP 2.3 无 trigger=manual 类型） -->
  <Teleport to="body">
    <div v-if="accountPopover.visible" class="parse-review-account-overlay" @click.self="closeAccountAssistOverlay">
      <div class="parse-review-account-panel" :style="accountAssistPanelStyle" @click.stop>
        <div class="parse-review-account-original">{{ accountPopover.originalToken }}</div>
        <div v-if="accountDescriptionByName[accountPopover.originalToken]" class="parse-review-account-desc">
          {{ accountDescriptionByName[accountPopover.originalToken] }}
        </div>
        <el-input ref="accountOverlayQueryRef" v-model="accountAssistQuery" class="parse-review-account-query" clearable
          placeholder="输入账户名或描述筛选；↑↓ 选择，回车 / Tab 确认" @keydown="onOverlayQueryKeydown" />
        <ul v-if="overlayAccountMatches.length > 0" ref="accountSuggestionsListRef"
          class="parse-review-account-suggestions" role="listbox">
          <li v-for="(item, idx) in overlayAccountMatches" :key="item.account" role="option" :class="[
            'parse-review-account-suggestion-item',
            { 'is-active': idx === overlayActiveIndex }
          ]" @click="applyAccountReplacementByName(item.account)">
            <span class="parse-review-account-suggestion-name">{{ item.account }}</span>
            <span v-if="item.description" class="parse-review-account-suggestion-desc">
              {{ item.description }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>

  <!-- 点击预览内标签：添加标签浮层 -->
  <Teleport to="body">
    <div v-if="tagPopover.visible" class="parse-review-tag-overlay" @click.self="closeTagAssistOverlay">
      <div class="parse-review-tag-panel" :style="tagAssistPanelStyle" @click.stop>
        <div class="parse-review-tag-panel-title">添加标签</div>
        <el-input ref="tagOverlayQueryRef" v-model="tagAssistQuery" class="parse-review-tag-query" clearable
          placeholder="搜索标签路径；↑↓ 选择，回车添加" @keydown="onTagOverlayQueryKeydown" />
        <ul v-if="overlayTagMatches.length > 0" ref="tagSuggestionsListRef" class="parse-review-tag-suggestions"
          role="listbox">
          <li v-for="(item, idx) in overlayTagMatches" :key="item.full_path" role="option" :class="[
            'parse-review-tag-suggestion-item',
            { 'is-active': idx === tagOverlayActiveIndex }
          ]" @click="applyTagAddition(item.full_path)">
            <span class="parse-review-tag-suggestion-name">#{{ item.full_path }}</span>
            <span v-if="item.description" class="parse-review-tag-suggestion-desc">
              {{ item.description }}
            </span>
          </li>
        </ul>
        <div v-else-if="tagAssistQuery.trim()" class="parse-review-tag-empty">
          未找到匹配的标签
        </div>
        <div v-else class="parse-review-tag-empty">
          暂无可添加的标签
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  useInlineMappingDialog,
  defaultMappingKeyFromOriginalRow,
  defaultAssetMappingKeyFromOriginalRow
} from '../../composables/useInlineMappingDialog'
import { useParseEntryPreview } from '../../composables/useParseEntryPreview'
import AccountSelector from '../common/AccountSelector.vue'
import TagSelector from '../common/TagSelector.vue'
import {
  shouldShowParseReviewCreateMapping,
  isInstallmentRepaymentEntry,
  isNeutralParseReviewEntry,
  type FormattedEntry,
  type TagDetail,
  type TagSource
} from '../../types/parse-review'

const props = defineProps<{
  entries: FormattedEntry[]
  errorEntries: Record<string, string>
  validationWarnings: Record<string, string>
  /** 审核过期等只读场景，禁止编辑与浮层交互 */
  disabled?: boolean
  /** 反馈分类关键字后重解析该条目（含映射保存后的重解析） */
  onReparse: (
    uuid: string,
    selectedKey: string,
    mappingType?: 'expense' | 'income' | 'asset',
    propagateCandidates?: boolean
  ) => Promise<void>
  onPersistEdit: (
    uuid: string,
    editedFormatted: string,
    options?: { silent?: boolean }
  ) => Promise<{ validation_warning?: string } | void>
  onPatchTags: (
    uuid: string,
    payload: { action: 'add' | 'remove'; tag_path: string }
  ) => Promise<{
    edited_formatted?: string
    tag_details?: TagDetail[]
    tag_overrides?: FormattedEntry['tag_overrides']
  }>
  onRemoveEntry?: (uuid: string) => Promise<void>
  /** 新增/编辑映射前的登录检查（首页匿名试用需要） */
  requireAuth?: () => boolean
  /** 是否展示「来源账单」列（统一条目审核场景） */
  showSourceFile?: boolean
}>()

const entries = toRef(props, 'entries')
const disabled = computed(() => props.disabled === true)

const {
  isEntryTextEditMode,
  startTextEdit,
  setEntryInputRef,
  clearTabCompleteSession,
  bindEntryPreviewTab,
  onEntryPreviewShellClick,
  onEntryTextareaBlur,
  getEntryClasses,
  getEntryAutosize,
  buildLineSegments,
  accountPopover,
  accountAssistQuery,
  accountAssistPanelStyle,
  accountDescriptionByName,
  accountOverlayQueryRef,
  accountSuggestionsListRef,
  overlayAccountMatches,
  overlayActiveIndex,
  closeAccountAssistOverlay,
  openAccountAssistFromSegment,
  applyAccountReplacementByName,
  onOverlayQueryKeydown,
  tagPopover,
  tagAssistQuery,
  tagAssistPanelStyle,
  tagOverlayQueryRef,
  tagSuggestionsListRef,
  overlayTagMatches,
  tagOverlayActiveIndex,
  closeTagAssistOverlay,
  openTagAssist,
  applyTagAddition,
  removeTagFromEntry,
  onTagOverlayQueryKeydown,
  formatTagSourceLabel,
  getTagSourcesForPath
} = useParseEntryPreview({
  entries,
  errorEntries: toRef(props, 'errorEntries'),
  validationWarnings: toRef(props, 'validationWarnings'),
  disabled,
  onPersistEdit: (uuid, editedFormatted, options) =>
    props.onPersistEdit(uuid, editedFormatted, options),
  onPatchTags: (uuid, payload) => props.onPatchTags(uuid, payload),
  onRemoveEntry: props.onRemoveEntry ? (uuid: string) => props.onRemoveEntry!(uuid) : undefined
})

const {
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
} = useInlineMappingDialog()

const inferParseReviewMappingType = (row: FormattedEntry) => {
  const txType = row.original_row?.transaction_type?.trim()
  if (txType === '/' || txType === '不计收支') return 'asset' as const
  if (txType?.includes('收入')) return 'income' as const
  return 'expense' as const
}

const getParseReviewCreateDefaults = (row: FormattedEntry) => {
  const type = inferParseReviewMappingType(row)
  if (type === 'asset') {
    return {
      type,
      key: defaultAssetMappingKeyFromOriginalRow(row.original_row),
      party: ''
    }
  }
  const key = defaultMappingKeyFromOriginalRow(row.original_row)
  return { type, key, party: '' }
}

const buildParseReviewMappingOptions = (row: FormattedEntry) => ({
  row,
  inferType: inferParseReviewMappingType,
  getSelectedKey: (r: FormattedEntry) => r.selected_expense_key ?? undefined,
  getCreateDefaults: getParseReviewCreateDefaults,
  requireAuth: props.requireAuth,
  onReparse: (key: string, type: 'expense' | 'income' | 'asset') =>
    props.onReparse(row.uuid, key, type === 'asset' ? 'asset' : undefined, true)
})

const openCreateMappingForRow = (row: FormattedEntry) => {
  openForCreate(buildParseReviewMappingOptions(row))
}

const openEditCurrentMappingForRow = (row: FormattedEntry) => {
  openEditCurrentMapping(buildParseReviewMappingOptions(row))
}

const openEditMappingForRowByKey = (row: FormattedEntry, source: TagSource) => {
  if (source.type !== 'mapping' || !source.key) return
  const mappingType =
    source.mapping_type === 'asset'
      ? 'asset'
      : source.mapping_type === 'income'
        ? 'income'
        : 'expense'
  void openForEdit({
    ...buildParseReviewMappingOptions(row),
    inferType: () => mappingType,
    getSelectedKey: () => source.key
  })
}

// 处理关键字选择
const handleKeywordSelect = async (uuid: string, selectedKey: string) => {
  try {
    await props.onReparse(uuid, selectedKey)
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '重解析失败')
  }
}
</script>

<style scoped lang="scss">
.entry-preview-wrapper {
  position: relative;
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.6;

  &.has-error {

    :deep(.el-textarea__inner),
    :deep(.ep-textarea__inner),
    .entry-preview-render {
      border-color: var(--el-color-danger);
      box-shadow: 0 0 0 1px var(--el-color-danger) inset;
    }
  }

  &.has-warning {

    :deep(.el-textarea__inner),
    :deep(.ep-textarea__inner),
    .entry-preview-render {
      border-color: var(--el-color-warning);
      box-shadow: 0 0 0 1px var(--el-color-warning) inset;
    }
  }

  &.has-other {

    :deep(.el-textarea__inner),
    :deep(.ep-textarea__inner),
    .entry-preview-render {
      border-color: var(--ep-color-primary, var(--el-color-primary));
      box-shadow: 0 0 0 1px var(--ep-color-primary, var(--el-color-primary)) inset;
      background-color: var(--ep-color-primary-light-9, var(--el-color-primary-light-9));
    }
  }
}

// 暗黑模式下：避免 primary-light-* 过亮导致文本对比度差
:deep(html.dark) .entry-preview-wrapper.has-other {

  :deep(.el-textarea__inner),
  :deep(.ep-textarea__inner),
  .entry-preview-render {
    /* el-config-provider namespace=ep：暗黑语义在 --ep-*，--el-* 在 dist/index.css 中仍为亮色 */
    color: var(--ep-text-color-primary, var(--el-text-color-primary));
    background-color: color-mix(in srgb,
        var(--ep-color-primary, var(--el-color-primary)) 18%,
        var(--ep-bg-color, var(--el-bg-color)));
  }
}

.validation-message {
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
  padding: 4px 8px;
  border-radius: 4px;

  &.error-message {
    color: var(--el-color-danger);
    background-color: var(--el-color-danger-light-9);
  }

  &.warning-message {
    color: var(--el-color-warning);
    background-color: var(--el-color-warning-light-9);
  }
}

// 预览块与编辑 textarea 共用同一套内边距；高度随条目行数自适应。
// 空条目仍保留 1 行占位（line-height 1.6 + 上下 padding 10px + 上下 border 2px），保证可点选。
$entry-preview-inner-padding: 5px 11px;
$entry-preview-inner-radius: var(--el-border-radius-base);
$entry-preview-inner-border: 1px solid;
$entry-preview-min-height: calc(1 * 1.6em + 10px + 2px);

.entry-preview {
  width: 100%;

  :deep(.el-textarea),
  :deep(.ep-textarea) {
    display: block;
  }

  :deep(.el-textarea__inner),
  :deep(.ep-textarea__inner) {
    box-sizing: border-box;
    font-family: Monaco, Consolas, 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    min-height: $entry-preview-min-height;
    padding: $entry-preview-inner-padding;
    border-radius: $entry-preview-inner-radius;
    border-width: 1px;
    border-style: solid;
    resize: none;
    outline: none;
    transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
    background-color: var(--ep-input-bg-color, var(--el-input-bg-color, var(--ep-fill-color-blank, var(--el-fill-color-blank))));
    color: var(--ep-input-text-color, var(--el-input-text-color, var(--ep-text-color-regular, var(--el-text-color-regular))));
    border-color: var(--ep-input-border-color, var(--el-input-border-color, var(--ep-border-color, var(--el-border-color))));
  }
}

.entry-preview-render {
  display: block;
  width: 100%;
  box-sizing: border-box;
  font-family: Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  min-height: $entry-preview-min-height;
  white-space: pre-wrap;
  word-break: break-word;
  padding: $entry-preview-inner-padding;
  border-radius: $entry-preview-inner-radius;
  border: $entry-preview-inner-border var(--ep-input-border-color, var(--el-input-border-color, var(--ep-border-color, var(--el-border-color))));
  background-color: var(--ep-input-bg-color,
      var(--el-input-bg-color, var(--ep-fill-color-blank, var(--el-fill-color-blank))));
  color: var(--ep-input-text-color,
      var(--el-input-text-color, var(--ep-text-color-regular, var(--el-text-color-regular))));
  cursor: text;
  outline: none;
  transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

// 无校验态：预览外框为默认输入框色；修改态外框为主题色（与预览区分）
.entry-preview-wrapper.is-entry-preview-mode:not(.has-error):not(.has-warning):not(.has-other) {
  .entry-preview-render {
    border-color: var(--ep-input-border-color, var(--el-input-border-color, var(--ep-border-color, var(--el-border-color))));
  }

  .entry-preview-render:hover {
    border-color: var(--ep-input-hover-border-color,
        var(--el-input-hover-border-color, var(--ep-border-color-hover, var(--el-border-color-hover))));
  }

  .entry-preview-render:focus-visible {
    border-color: var(--ep-input-hover-border-color,
        var(--el-input-hover-border-color, var(--ep-border-color-hover, var(--el-border-color-hover))));
    box-shadow: none;
  }
}

.entry-preview-wrapper.is-entry-edit-mode:not(.has-error):not(.has-warning):not(.has-other) {

  :deep(.el-textarea__inner),
  :deep(.ep-textarea__inner) {
    border-color: var(--ep-color-primary, var(--el-color-primary));
    box-shadow: none;
  }

  :deep(.el-textarea__inner:hover),
  :deep(.ep-textarea__inner:hover) {
    border-color: var(--ep-color-primary, var(--el-color-primary));
  }

  :deep(.el-textarea__inner:focus),
  :deep(.ep-textarea__inner:focus) {
    border-color: var(--ep-color-primary, var(--el-color-primary));
    box-shadow: none;
  }
}

.entry-preview-wrapper.has-error .entry-preview-render:focus-visible {
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.entry-preview-wrapper.has-warning .entry-preview-render:focus-visible {
  border-color: var(--el-color-warning);
  box-shadow: 0 0 0 1px var(--el-color-warning) inset;
}

.entry-preview-wrapper.has-other .entry-preview-render:focus-visible {
  border-color: var(--ep-color-primary, var(--el-color-primary));
  box-shadow: 0 0 0 1px var(--ep-color-primary, var(--el-color-primary)) inset;
}

.entry-preview-line {
  display: block;
}

.entry-preview-account-link {
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  text-decoration: none;
  vertical-align: baseline;
}

.entry-preview-account-link:hover {
  color: var(--ep-color-primary, var(--el-color-primary));
}

.entry-preview-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0 2px;
  padding: 0 2px 0 4px;
  border-radius: 4px;
  background: var(--ep-fill-color-light, var(--el-fill-color-light));
  vertical-align: baseline;
}

.entry-preview-tag-link {
  cursor: help;
  color: var(--ep-color-primary, var(--el-color-primary));
}

.entry-preview-tag-remove {
  font: inherit;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  margin: 0;
  border: none;
  background: none;
  color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
}

.entry-preview-tag-remove:hover {
  color: var(--ep-color-danger, var(--el-color-danger));
}

.entry-preview-tag-add {
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0 4px;
  margin-left: 4px;
  border: 1px dashed var(--ep-border-color, var(--el-border-color));
  border-radius: 4px;
  background: none;
  color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
  vertical-align: baseline;
}

.entry-preview-tag-add:hover {
  color: var(--ep-color-primary, var(--el-color-primary));
  border-color: var(--ep-color-primary, var(--el-color-primary));
}

.entry-preview-plain {
  cursor: text;
}

.ai-classification-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.current-selection,
.candidates {
  display: flex;
  align-items: center;
}

.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
  flex-shrink: 0;
}

.label.muted {
  color: var(--el-text-color-placeholder);
}

.candidate-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.selected-tag.is-editable {
  cursor: pointer;
  transition: all 0.3s;

  .edit-hint {
    margin-left: 4px;
    font-size: 12px;
    vertical-align: -0.1em;
  }
}

.selected-tag.is-editable:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.candidate-tag {
  cursor: pointer;
  transition: all 0.3s;
}

.candidate-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.candidate-tag.is-selected {
  font-weight: bold;
}

.score {
  font-size: 0.85em;
  color: var(--el-text-color-placeholder);
  margin-left: 2px;
}

.no-category-tip {
  color: var(--ep-text-color-placeholder, var(--el-text-color-placeholder));
  font-size: 12px;
  display: inline-block;
  line-height: 22px;
  padding: 0 9px;
  border-radius: 4px;
  background: var(--ep-fill-color-light, var(--el-fill-color-light));
  vertical-align: middle;
}

// 暗黑模式下：无分类建议提示更柔和、对比度更稳定
html.dark .no-category-tip {
  background: var(--ep-fill-color-dark, var(--el-fill-color-dark));
  color: var(--ep-text-color-placeholder, var(--el-text-color-placeholder));
}

.add-mapping-btn {
  margin-left: 8px;
}
</style>

<style lang="scss">
.parse-review-account-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background-color: color-mix(in srgb,
      var(--ep-overlay-color-lighter, var(--el-overlay-color-lighter, #000)) 12%,
      transparent);
}

.parse-review-account-panel {
  background-color: var(--ep-bg-color-overlay, var(--ep-bg-color, var(--el-bg-color)));
  border: 1px solid var(--ep-border-color, var(--el-border-color));
  border-radius: var(--ep-border-radius-base, var(--el-border-radius-base));
  padding: 8px;
  box-shadow: var(--ep-box-shadow, var(--el-box-shadow));
}

.parse-review-account-original {
  font-family: Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: var(--ep-border-radius-small, var(--el-border-radius-small));
  background-color: var(--ep-fill-color-light, var(--el-fill-color-light));
  color: var(--ep-text-color-primary, var(--el-text-color-primary));
  word-break: break-all;
}

.parse-review-account-desc {
  font-size: 12px;
  line-height: 1.5;
  padding: 0 8px 8px;
  color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
}

.parse-review-account-query {
  width: 100%;

  .ep-input__wrapper,
  .el-input__wrapper {
    background-color: var(--ep-fill-color-blank, var(--el-fill-color-blank));
    box-shadow: 0 0 0 1px var(--ep-input-border-color, var(--el-input-border-color)) inset;
  }

  .ep-input__inner,
  .el-input__inner {
    color: var(--ep-text-color-regular, var(--el-text-color-regular));
  }
}

.parse-review-account-suggestions {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--ep-border-color-lighter, var(--el-border-color-lighter));
  border-radius: var(--ep-border-radius-small, var(--el-border-radius-small));
  background-color: var(--ep-fill-color-blank, var(--el-fill-color-blank));
}

.parse-review-account-suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ep-text-color-regular, var(--el-text-color-regular));
}

.parse-review-account-suggestion-name {
  flex: 1;
  min-width: 0;
  font-family: Monaco, Consolas, 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parse-review-account-suggestion-desc {
  flex-shrink: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
}

.parse-review-account-suggestion-item:hover,
.parse-review-account-suggestion-item.is-active {
  background-color: var(--ep-fill-color-light, var(--el-fill-color-light));
  color: var(--ep-text-color-primary, var(--el-text-color-primary));
}

html.dark .parse-review-account-suggestion-item.is-active {
  background-color: var(--ep-fill-color-dark, var(--el-fill-color-dark));
}

.parse-review-tag-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background-color: color-mix(in srgb,
      var(--ep-overlay-color-lighter, var(--el-overlay-color-lighter, #000)) 12%,
      transparent);
}

.parse-review-tag-panel {
  background-color: var(--ep-bg-color-overlay, var(--ep-bg-color, var(--el-bg-color)));
  border: 1px solid var(--ep-border-color, var(--el-border-color));
  border-radius: var(--ep-border-radius-base, var(--el-border-radius-base));
  padding: 8px;
  box-shadow: var(--ep-box-shadow, var(--el-box-shadow));
}

.parse-review-tag-panel-title {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px 8px;
  color: var(--ep-text-color-primary, var(--el-text-color-primary));
}

.parse-review-tag-query {
  width: 100%;
}

.parse-review-tag-suggestions {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--ep-border-color-lighter, var(--el-border-color-lighter));
  border-radius: var(--ep-border-radius-small, var(--el-border-radius-small));
  background-color: var(--ep-fill-color-blank, var(--el-fill-color-blank));
}

.parse-review-tag-suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ep-text-color-regular, var(--el-text-color-regular));
}

.parse-review-tag-suggestion-name {
  flex: 1;
  min-width: 0;
  font-family: Monaco, Consolas, 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parse-review-tag-suggestion-desc {
  flex-shrink: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
}

.parse-review-tag-suggestion-item:hover,
.parse-review-tag-suggestion-item.is-active {
  background-color: var(--ep-fill-color-light, var(--el-fill-color-light));
}

.parse-review-tag-empty {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ep-text-color-secondary, var(--el-text-color-secondary));
  padding: 8px;
}

.entry-preview-tag-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-preview-tag-source-line {
  font-size: 12px;
}

.entry-preview-tag-source-link {
  font: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin: 0;
  border: none;
  background: none;
  text-decoration: underline;
}
</style>
