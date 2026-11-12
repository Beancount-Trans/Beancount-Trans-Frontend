<template>
    <div class="file-management">
        <!-- 文件路径展示 -->
        <div class="path-display">
            <el-breadcrumb separator="/">
                <el-breadcrumb-item v-for="(item, index) in breadcrumb" :key="index" @click="navigateTo(item.id)">
                    {{ item.name }}
                </el-breadcrumb-item>
            </el-breadcrumb>
        </div>

        <!-- 工具栏 -->
        <div class="toolbar">
            <div class="toolbar-primary-actions">
                <el-button id="tour-upload-button" type="primary" :disabled="isTourStep2" @click="triggerUpload">
                    <el-icon>
                        <UploadFilled />
                    </el-icon>
                    上传账单
                </el-button>
                <el-button plain @click="showCreateFolderDialog">
                    <el-icon>
                        <Folder />
                    </el-icon>
                    新建文件夹
                </el-button>
            </div>

            <!-- 隐藏的上传组件 -->
            <el-upload :show-file-list="false" :http-request="customUpload" :before-upload="validateUpload">
                <button ref="uploadTrigger" style="display: none"></button>
            </el-upload>

            <el-input v-model="searchQuery" placeholder="搜索文件" class="search-input" clearable>
                <template #prefix>
                    <el-icon>
                        <Search />
                    </el-icon>
                </template>
                <template #append>
                    <el-select v-model="selectedStatusFilter" placeholder="状态筛选" clearable style="width: 120px;"
                        class="status-filter-select">
                        <el-option v-for="option in statusFilterOptions" :key="option.value || 'all'"
                            :label="option.label" :value="option.value">
                        </el-option>
                    </el-select>
                </template>
            </el-input>

            <el-select v-model="batchAction" placeholder="批量操作" class="batch-select"
                :disabled="selectedItems.length === 0" @change="executeBatchAction">
                <el-option label="解析" value="parse"></el-option>
                <el-option label="取消解析" value="cancel"></el-option>
                <el-option label="下载" value="download"></el-option>
                <el-option label="删除" value="delete"></el-option>
                <el-option label="移动" value="move"></el-option>
            </el-select>
        </div>

        <!-- 上传进度条（独立显示，不影响工具栏布局） -->
        <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress-container">
            <el-progress :percentage="uploadProgress" :stroke-width="6" status="success" />
        </div>

        <!-- 上传指引：空目录 / 仅文件夹 / 仅示例账单时显示 -->
        <div v-if="showUploadHint" id="tour-upload-hint" class="upload-hint-banner" role="note">
            <el-icon class="upload-hint-banner__icon" :size="20">
            </el-icon>
            <div class="upload-hint-banner__content">
                <p class="upload-hint-banner__lead">
                    <template v-if="uploadHintVariant === 'sample-only'">
                        当前为示例账单，仅供体验。上传自己的账单前，请先从各渠道导出（
                    </template>
                    <template v-else>
                        当前目录尚无账单文件。上传前请先从各渠道导出账单（
                    </template>
                    <el-link :href="BILLS_EXPORT_DOCS_URL" target="_blank" rel="noopener noreferrer" type="primary"
                        class="upload-hint-banner__inline-link">
                        查看导出方法
                    </el-link>
                    ）。
                </p>
                <p class="upload-hint-banner__tip">
                    建议单次导出跨度不超过一个月，且各渠道取同一段时间。
                </p>
            </div>
        </div>

        <!-- 示例清理指引：自有账单已写入账本且仍存在示例时显示 -->
        <div v-if="showSampleCleanupHint" class="sample-cleanup-banner" role="note">
            <el-icon class="sample-cleanup-banner__icon" :size="20">
            </el-icon>
            <div class="sample-cleanup-banner__content">
                <p class="sample-cleanup-banner__lead">
                    您已有账单写入账本。建议删除示例文件，避免与真实账目重复计入报表。
                </p>
                <p class="sample-cleanup-banner__meta">
                    需要时可
                    <router-link to="/trans" class="sample-cleanup-banner__route-link">前往账单解析页</router-link>
                    下载示例，或从
                    <el-link :href="SAMPLE_BILL_DOWNLOAD_URLS.wechat" target="_blank" rel="noopener noreferrer"
                        type="primary" class="sample-cleanup-banner__inline-link">微信</el-link>
                    /
                    <el-link :href="SAMPLE_BILL_DOWNLOAD_URLS.alipay" target="_blank" rel="noopener noreferrer"
                        type="primary" class="sample-cleanup-banner__inline-link">支付宝</el-link>
                    示例链接重新获取。
                </p>
            </div>
            <el-button type="warning" plain :loading="isCleaningSampleBills" :disabled="shouldDisableDownloadAndDelete"
                @click="cleanupSampleBills">
                删除示例账单
            </el-button>
        </div>

        <!-- 任务状态对话框  -->
        <el-dialog v-model="parseDialogVisible" title="解析任务进度" width="600px" :show-close="false"
            :close-on-click-modal="false" :close-on-press-escape="false">
            <el-progress :percentage="parseProgressPercentage" :status="parseStatus" />
            <div class="task-info">
                <p>任务组ID: {{ activeTaskGroupIds.length > 0 ? activeTaskGroupIds[activeTaskGroupIds.length - 1] : '' }}
                </p>
                <p>状态: {{ parseStatusText }}</p>
                <p>进度: {{ completedTasks }}/{{ totalTasks }}</p>
            </div>
            <el-table :data="taskDetails" height="200px" border>
                <el-table-column prop="file_id" label="文件ID" width="120" />
                <el-table-column prop="file_name" label="文件名" />
                <el-table-column prop="status" label="状态" width="100">
                    <template #default="{ row }">
                        <el-tooltip v-if="row.status === 'failed' && row.error" :content="row.error" placement="top">
                            <el-tag :type="statusTagType(row.status)">
                                {{ translateStatus(row.status) }}
                            </el-tag>
                        </el-tooltip>
                        <el-tag v-else :type="statusTagType(row.status)">
                            {{ translateStatus(row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                    <template #default="{ row }">
                        <el-tooltip v-if="row.status === 'failed' && row.error" :content="row.error" placement="top">
                            <span class="parse-failed-hint">解析失败</span>
                        </el-tooltip>
                        <el-button
                            v-else-if="row.status === 'pending' || row.status === 'processing' || row.status === 'parsed'"
                            size="small" type="warning" @click="cancelParse([row.file_id])">
                            取消
                        </el-button>
                        <el-button v-else-if="row.status === 'needs_password'" size="small" type="primary"
                            @click="handleNeedsPassword(row)">
                            输入密码
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <template #footer>
                <el-button @click="handleParseDialogClose">{{ parseDialogCloseText }}</el-button>
            </template>
        </el-dialog>

        <div v-if="showParseProgressEntry" class="parse-progress-entry">
            <div class="parse-progress-entry__content">
                <div class="parse-progress-entry__title">解析中任务</div>
                <div class="parse-progress-entry__meta">
                    后台继续中，当前进度 {{ completedTasks }}/{{ totalTasks }}，状态：{{ parseStatusText }}
                </div>
            </div>
            <el-button type="primary" @click="reopenParseDialog">查看进度</el-button>
        </div>

        <!-- 文件列表 (带拖拽区域) -->
        <div class="file-table-dropzone" @dragenter="onDragEnter" @dragleave="onDragLeave" @dragover="onDragOver"
            @drop="onDrop">
            <div v-show="isDragActive" class="drop-overlay">
                <div class="drop-overlay-content">
                    <el-icon class="drop-icon" :size="48">
                        <UploadFilled />
                    </el-icon>
                    <p class="drop-text">拖拽文件到此处上传</p>
                    <p class="drop-sub-text">支持多文件，最大 20MB/个</p>
                </div>
            </div>

            <el-table ref="fileTableRef" :data="filteredItems" style="width: 100%"
                @selection-change="handleSelectionChange" highlight-current-row class="file-table" id="tour-file-table">
                <el-table-column type="selection" width="55" />

                <el-table-column v-if="isGlobalSearch" prop="path" label="路径">
                    <template #default="{ row }">
                        <el-text type="info">{{ row.path || '根目录' }}</el-text>
                    </template>
                </el-table-column>

                <el-table-column prop="name" label="名称">
                    <template #default="{ row }">
                        <div class="flex items-center cursor-pointer" @click="handleNodeClick(row)">
                            <el-icon
                                :color="row.node_type === 'directory' ? 'var(--el-color-warning)' : 'var(--el-color-primary)'">
                                <component :is="row.node_type === 'directory' ? Folder : Document" />
                            </el-icon>
                            <span class="ml-2">{{ row.name }}</span>
                            <el-tag v-if="row.node_type === 'file' && isSampleBillFile(row.name)" type="info"
                                size="small" class="sample-file-tag">
                                示例
                            </el-tag>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column prop="date" label="创建时间">
                    <template #default="{ row }">
                        {{ formatDateTime(row.node_type === 'directory' ? row.created_at : row.uploaded_at) }}
                    </template>
                </el-table-column>

                <el-table-column prop="size" label="大小">
                    <template #default="{ row }">
                        {{ row.node_type === 'file' ? row.size_display : '-' }}
                    </template>
                </el-table-column>

                <el-table-column prop="status" label="状态">
                    <template #default="{ row }">
                        <el-tooltip
                            v-if="row.node_type === 'file' && (row.parse_status === 'failed' || row.parse_status === 'needs_password') && (row.error_message || row.parse_status === 'needs_password')"
                            :content="row.error_message || (row.parse_status === 'needs_password' ? '该文件已加密，请点击解析后输入密码重试' : '')"
                            placement="top">
                            <el-tag :type="getStatusColor(row.parse_status || row.status)">
                                {{ translateStatus(row.parse_status || row.status) }}
                            </el-tag>
                        </el-tooltip>
                        <el-tag v-else :type="getStatusColor(row.parse_status || row.status)">
                            {{ translateStatus(row.parse_status || row.status) }}
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="操作" width="120">
                    <template #default="{ row, $index }">
                        <!-- 解析/取消按钮（根据状态切换，parsed状态也可以取消以清除.bean文件内容） -->
                        <el-tooltip
                            v-if="row.node_type === 'file' && (row.parse_status === 'pending' || row.parse_status === 'processing' || row.parse_status === 'parsed')"
                            :content="row.parse_status === 'parsed' ? '清除解析结果' : '取消解析'" placement="top">
                            <el-button icon="Tickets" circle size="small" :disabled="isTourStep2"
                                @click="cancelSingleFile(row)">
                            </el-button>
                        </el-tooltip>
                        <el-tooltip v-else-if="row.node_type === 'file'" content="解析" placement="top">
                            <el-button icon="Tickets" circle size="small"
                                :class="{ 'tour-parse-first-file': row.node_type === 'file' && row.name === tourParseTargetFileName }"
                                :disabled="isTourStep2" @click="parseSingleFile(row)">
                            </el-button>
                        </el-tooltip>

                        <el-button v-if="row.node_type === 'file'" icon="Download" circle size="small"
                            :disabled="shouldDisableDownloadAndDelete" @click="downloadFile(row.id)" />

                        <!-- <el-tooltip content="移动" placement="top">
                        <el-button icon="FolderOpened" circle size="small"
                            :disabled="shouldDisableDownloadAndDelete" @click="openMoveDialog(row)" />
                    </el-tooltip> -->

                        <el-tooltip content="删除" placement="top">
                            <el-popconfirm title="将同时清除此文件的解析结果，是否继续？" @confirm="deleteItem(row)">
                                <template #reference>
                                    <el-button icon="Delete" circle size="small"
                                        :disabled="shouldDisableDownloadAndDelete" />
                                </template>
                            </el-popconfirm>
                        </el-tooltip>

                    </template>
                </el-table-column>
            </el-table>
        </div>

        <el-dialog v-model="createFolderDialog" title="新建文件夹">
            <el-form @submit.prevent="createFolder">
                <el-form-item label="文件夹名称">
                    <el-input v-model="newFolderName" autofocus />
                </el-form-item>
                <div class="text-right">
                    <el-button @click="createFolderDialog = false">取消</el-button>
                    <el-button type="primary" native-type="submit">创建</el-button>
                </div>
            </el-form>
        </el-dialog>

        <!-- 移动到指定目录对话框 -->
        <el-dialog v-model="moveDialog" title="移动到..." width="400px" @open="onMoveDialogOpen"
            @close="onMoveDialogClose">
            <el-tree ref="moveTreeRef" :data="moveTreeData" :props="{ label: 'name' }" node-key="id" highlight-current
                default-expand-all @node-click="onMoveTreeSelect" />
            <template #footer>
                <el-button @click="moveDialog = false">取消</el-button>
                <el-button type="primary" :disabled="targetDirectoryId === null" @click="executeMoveAction">
                    确定
                </el-button>
            </template>
        </el-dialog>

        <!-- 密码输入对话框 -->
        <el-dialog v-model="passwordDialogVisible" title="输入解密密码" width="450px" :close-on-click-modal="false">
            <div class="password-dialog-content">
                <p class="password-dialog-tip" v-if="passwordForm.length > 1">您选择了多个文件，请为加密文件提供密码（未加密的文件留空即可）。</p>
                <p class="password-dialog-tip" v-else>如果文件被加密（如PDF或ZIP），请提供密码，否则留空。</p>
                <el-form label-position="top">
                    <el-form-item v-for="(file, index) in passwordForm" :key="file.id" :label="file.name">
                        <el-input v-model="file.password" type="password" placeholder="密码（选填）" show-password>
                            <template #prefix>
                                <el-icon>
                                    <Lock />
                                </el-icon>
                            </template>
                        </el-input>
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <el-button @click="passwordDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="confirmParseWithPassword">确认解析</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { Folder, Document, Lock, UploadFilled, FolderOpened, InfoFilled } from '@element-plus/icons-vue'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import axios, { fetchWithAuth } from '../../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TagProps } from 'element-plus'
import { parse } from 'path'
import {
    startUserTour,
    continueUserTour,
    shouldResumeTour,
    getTourProgress,
    resumeTourFromStep,
    initTourState,
    saveTourProgress,
    TOUR_FIRST_PARSE_FILE_NAME,
    SAMPLE_BILL_FILE_NAMES,
    BILLS_EXPORT_DOCS_URL,
    SAMPLE_BILL_DOWNLOAD_URLS,
} from '../../utils/userTour'
import { emitTaskBannerRefresh } from '../../utils/accountEvents'
import { useRouter, useRoute } from 'vue-router'
import { checkAndResumeTour, isRouteMatchForStep } from '../../utils/tourRecovery'
import { useCapabilities } from '../../capabilities'


interface FileItem {
    id: string
    name: string
    node_type: 'file' | 'directory'
    parse_status?: string
    error_message?: string
    size_display?: string
    uploaded_at?: string
    updated_at?: string
    created_at?: string
}

// 路由
const router = useRouter()
const route = useRoute()

// 状态管理
const items = ref<FileItem[]>([])
const breadcrumb = ref<Array<{ id: string | null, name: string }>>([])
const currentDirectoryId = ref<string | null>(null)
const searchQuery = ref('')
const batchAction = ref('')
const selectedItems = ref<FileItem[]>([])
const createFolderDialog = ref(false)
const moveDialog = ref(false)
const newFolderName = ref('')
const targetDirectoryId = ref<string | null>(null)
const moveTreeData = ref<Array<{ id: number; name: string; children?: unknown[] }>>([])
const moveTreeRef = ref<InstanceType<typeof import('element-plus').ElTree> | null>(null)
const fileTableRef = ref<InstanceType<typeof import('element-plus').ElTable> | null>(null)
const moveSingleItem = ref<FileItem | null>(null)
const uploadProgress = ref(0)
const isUploading = ref(false)
const rootDirectoryId = ref<string | null>(null)
const isGlobalSearch = ref(false);
const globalSearchResults = ref<FileItem[]>([]);
const uploadTrigger = ref<HTMLButtonElement | null>(null)
const selectedStatusFilter = ref<string | null>(null)

// 密码弹窗相关状态
const passwordDialogVisible = ref(false)
const passwordForm = ref<{ id: string; name: string; password: string }[]>([])

// 拖拽上传相关状态
const isDragActive = ref(false)
const dragCounter = ref(0)
const { can } = useCapabilities()
let progressTimeoutId: ReturnType<typeof setTimeout> | null = null

// 状态筛选选项配置
const statusFilterOptions = [
    { value: null, label: '全部状态' },
    { value: 'unprocessed', label: '未解析' },
    // { value: 'pending', label: '待解析' },
    // { value: 'processing', label: '解析中' },
    { value: 'parsed', label: '已解析' },
    { value: 'failed', label: '解析失败' },
    // { value: 'needs_password', label: '需要密码' },
    { value: 'cancelled', label: '取消解析' }
]

function triggerUpload() {
    if (!can('file.write')) return;
    if (isTourStep2.value) {
        ElMessage.warning('导览进行中，请先完成当前步骤');
        return;
    }
    uploadTrigger.value?.click();
}

async function customUpload(options: any) {
    if (!can('file.write')) return;
    const { file, onProgress, onSuccess, onError, skipRefresh } = options;
    const uploadedFileName = file.name;

    try {
        isUploading.value = true;
        uploadProgress.value = 0;

        const formData = new FormData();
        formData.append('file', file);

        const directoryId = currentDirectoryId.value !== null
            ? currentDirectoryId.value
            : rootDirectoryId.value;

        if (directoryId) {
            formData.append('directory', directoryId);
        }

        const response = await axios.post('/files/', formData, {
            headers: {
                // 覆盖默认的Content-Type，因为我们要上传文件
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                const percent = Math.round(
                    (progressEvent.loaded * 100) / (progressEvent.total || 1)
                );
                uploadProgress.value = percent;
                onProgress({ percent });
            }
        });

        onSuccess(response);
        ElMessage.success(`文件 "${uploadedFileName}" 上传成功`);
        if (!skipRefresh) {
            await loadDirectoryContent();
        }
    } catch (error: unknown) {
        console.error('文件上传失败:', error);
        let errorMsg = '文件上传失败';

        // 类型安全的错误处理
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as {
                response?: {
                    data?: {
                        error?: string,
                        existing_files?: Array<{ directory_path: string, directory_id: number }>
                    },
                    status?: number
                }
            };
            const errorData = axiosError.response?.data;
            const errorText = errorData?.error || '';

            // 检测同名文件冲突错误
            if (errorData?.existing_files && errorData.existing_files.length > 0) {
                const directoryPaths = errorData.existing_files.map(f => f.directory_path).join('、');
                errorMsg = `文件名 "${uploadedFileName}" 在以下目录已存在：${directoryPaths}，请勿重复上传。`;
            }
            // 检测同一目录重复文件错误（数据库唯一约束）
            else if (errorText.includes('duplicate key') || errorText.includes('already exists')) {
                // 提取文件名，格式：Key (name, directory_id)=(文件名, 目录ID) already exists
                const match = errorText.match(/\(name, directory_id\)=\(([^,]+),\s*\d+\)/);
                if (match && match[1]) {
                    const fileName = match[1].trim();
                    errorMsg = `文件名 "${fileName}" 在当前目录下已存在，请勿重复上传`;
                } else {
                    errorMsg = '文件在当前目录下已存在，请勿重复上传';
                }
            } else if (errorText) {
                // 其他错误，使用后端返回的错误信息
                errorMsg = errorText;
            }
        }

        ElMessage.error(errorMsg);
        onError(error);
    } finally {
        isUploading.value = false;
        if (progressTimeoutId) clearTimeout(progressTimeoutId);
        progressTimeoutId = setTimeout(() => {
            if (!isUploading.value) {
                uploadProgress.value = 0;
            }
        }, 2000);
    }
}

// 拖拽上传相关函数
function onDragEnter(e: DragEvent) {
    e.preventDefault();
    if (isTourStep2.value) return;
    dragCounter.value++;
    if (dragCounter.value === 1) {
        isDragActive.value = true;
    }
}

function onDragLeave(e: DragEvent) {
    e.preventDefault();
    if (isTourStep2.value) return;
    dragCounter.value--;
    if (dragCounter.value === 0) {
        isDragActive.value = false;
    }
}

function onDragOver(e: DragEvent) {
    e.preventDefault(); // 必须调用以允许 drop
}

async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragCounter.value = 0;
    isDragActive.value = false;

    if (!can('file.write')) return;

    if (isTourStep2.value) {
        ElMessage.warning('导览进行中，请先完成当前步骤');
        return;
    }

    if (!currentDirectoryId.value && !rootDirectoryId.value) {
        ElMessage.error('请先等待目录加载完成');
        return;
    }

    if (!e.dataTransfer || !e.dataTransfer.files.length) return;

    // 检查是否包含文件夹
    let hasFolder = false;
    if (e.dataTransfer.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
            const item = e.dataTransfer.items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item as any).getAsEntry ? (item as any).getAsEntry() : null;
                if (entry && entry.isDirectory) {
                    hasFolder = true;
                    break;
                }
            }
        }
    }

    if (hasFolder) {
        ElMessage.warning('仅支持文件拖拽上传，不支持文件夹');
        return;
    }

    const files = Array.from(e.dataTransfer.files);
    await processUploadQueue(files);
}

async function processUploadQueue(files: File[]) {
    // 过滤不符合要求的文件
    const validFiles = files.filter(f => validateUpload(f));
    if (validFiles.length === 0) return;

    let hasUploaded = false;

    // 串行上传
    for (const file of validFiles) {
        await new Promise<void>((resolve) => {
            customUpload({
                file,
                onProgress: () => { },
                onSuccess: () => {
                    hasUploaded = true;
                    resolve();
                },
                onError: () => {
                    // 发生错误也继续下一个
                    resolve();
                },
                skipRefresh: true
            });
        });
    }

    // 队列全部结束后刷新一次目录
    if (hasUploaded) {
        await loadDirectoryContent();
    }
}

// 上传前验证
function validateUpload(file: File) {
    // 验证文件大小 (限制为20MB)
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
        ElMessage.error('文件大小不能超过20MB')
        return false
    }

    // 验证目录是否已选择
    if (!currentDirectoryId.value && !rootDirectoryId.value) {
        ElMessage.error('请先选择目录或等待目录加载完成')
        return false
    }

    return true
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// 认证头部
// 使用响应式 ref 跟踪当前导览步骤，确保步骤切换时 UI 能及时更新
const currentTourStep = ref<number | null>(null);
const isInTourRef = ref(false);

// 检查导览状态的函数
function checkTourState() {
    // 检查是否在导览中
    let inTour = false;
    if (shouldResumeTour()) {
        inTour = true;
    } else {
        const tourInProgress = sessionStorage.getItem('tour_in_progress');
        if (tourInProgress === 'true') {
            inTour = true;
        } else {
            const tourStatus = localStorage.getItem('tour_status');
            if (tourStatus === 'in_progress') {
                inTour = true;
            }
        }
    }
    isInTourRef.value = inTour;

    // 获取当前步骤
    if (inTour) {
        const progress = getTourProgress();
        currentTourStep.value = progress?.currentStep ?? null;
    } else {
        currentTourStep.value = null;
    }
}

// 初始化检查
checkTourState();

// 定期检查导览状态变化（每500ms检查一次）
let tourStateCheckInterval: ReturnType<typeof setInterval> | null = null;

// 检查是否在导览中（通过多种方式检查）
const isInTour = computed(() => {
    return isInTourRef.value;
});

// 检查是否在导览步骤2（需要禁用所有文件操作：解析、下载、删除）
const isTourStep2 = computed(() => {
    if (!isInTourRef.value) {
        return false;
    }
    return currentTourStep.value === 1; // 步骤2对应索引1
});

// 检查是否在导览步骤3（只禁用下载和删除，不禁用解析）
const isTourStep3 = computed(() => {
    if (!isInTourRef.value) {
        return false;
    }
    return currentTourStep.value === 2; // 步骤3对应索引2
});

// 检查是否应该禁用下载和删除（步骤2或步骤3）
const shouldDisableDownloadAndDelete = computed(() => {
    return isTourStep2.value || isTourStep3.value;
});

// Authorization 由 utils/request 拦截器统一附加
const headers = computed(() => ({}))

watch(searchQuery, async (newQuery) => {
    if (newQuery) {
        isGlobalSearch.value = true;
        globalSearchResults.value = await performGlobalSearch(newQuery);
    } else {
        isGlobalSearch.value = false;
        // 清空搜索结果，显示当前目录内容
        await loadDirectoryContent();
    }
});

// 计算属性
const filteredItems = computed(() => {
    let result: FileItem[] = [];

    if (isGlobalSearch.value && searchQuery.value) {
        // 全局搜索模式 - 显示全局结果
        result = globalSearchResults.value;
    } else {
        // 本地搜索模式 - 在当前目录中搜索
        result = items.value.filter(item =>
            item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
        );
    }

    // 应用状态筛选（仅对文件类型生效，目录不受影响）
    if (selectedStatusFilter.value !== null) {
        result = result.filter(item => {
            // 目录始终显示
            if (item.node_type === 'directory') {
                return true;
            }
            // 文件需要匹配状态筛选
            return item.parse_status === selectedStatusFilter.value;
        });
    }

    return result;
});

// 导览第三步要高亮的解析按钮对应的文件名（优先 TOUR_FIRST_PARSE_FILE_NAME，否则第一个文件）
const tourParseTargetFileName = computed(() => {
    const fileRows = filteredItems.value.filter((item) => item.node_type === 'file');
    const preferred = fileRows.find((f) => f.name === TOUR_FIRST_PARSE_FILE_NAME);
    return (preferred && preferred.name) || (fileRows[0] && fileRows[0].name) || '';
});

const sampleBillFileNameSet = new Set<string>(SAMPLE_BILL_FILE_NAMES);

type UploadHintVariant = 'no-files' | 'sample-only';

const uploadHintVariant = computed<UploadHintVariant | null>(() => {
    if (isGlobalSearch.value && searchQuery.value) {
        return null;
    }

    const files = items.value.filter((item) => item.node_type === 'file');

    if (files.length === 0) {
        return 'no-files';
    }

    if (files.every((file) => sampleBillFileNameSet.has(file.name))) {
        return 'sample-only';
    }

    return null;
});

const showUploadHint = computed(() => uploadHintVariant.value !== null);

function isSampleBillFile(fileName: string): boolean {
    return sampleBillFileNameSet.has(fileName);
}

/** 自有账单已解析并写入账本（parsed；pending_review 尚未写入） */
function isUserBillWrittenToLedger(file: FileItem): boolean {
    return file.node_type === 'file'
        && !isSampleBillFile(file.name)
        && file.parse_status === 'parsed';
}

const sampleFilesInDirectory = computed(() =>
    items.value.filter((item) => item.node_type === 'file' && isSampleBillFile(item.name)),
);

const hasUserBillWrittenToLedger = computed(() =>
    items.value.some(isUserBillWrittenToLedger),
);

const showSampleCleanupHint = computed(() => {
    if (isGlobalSearch.value && searchQuery.value) {
        return false;
    }
    return hasUserBillWrittenToLedger.value && sampleFilesInDirectory.value.length > 0;
});

const isCleaningSampleBills = ref(false);

async function cleanupSampleBills() {
    if (shouldDisableDownloadAndDelete.value) {
        ElMessage.warning('导览进行中，请先完成导览步骤');
        return;
    }

    const targets = sampleFilesInDirectory.value;
    if (targets.length === 0) {
        return;
    }

    const names = targets.map((f) => f.name).join('、');
    try {
        await ElMessageBox.confirm(
            `将删除 ${targets.length} 个示例文件（${names}）及其解析结果，是否继续？`,
            '删除示例账单',
            { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
        );
    } catch {
        return;
    }

    isCleaningSampleBills.value = true;
    try {
        await Promise.all(
            targets.map((file) =>
                axios.delete(`/files/${file.id}/`, { headers: headers.value }),
            ),
        );
        ElMessage.success('示例账单已删除');
        await loadDirectoryContent();
    } catch (error) {
        ElMessage.error('删除示例账单失败');
        console.error(error);
    } finally {
        isCleaningSampleBills.value = false;
    }
}

// 初始化加载
onMounted(async () => {
    await loadDirectoryContent()

    // 等待 DOM 渲染
    await nextTick();

    // 检查是否需要启动或恢复导览
    const shouldStartTour = localStorage.getItem('start_tour');
    const needsResume = shouldResumeTour();
    const currentPath = route.path;

    if (shouldStartTour === 'true') {
        // 新用户首次启动导览
        localStorage.removeItem('start_tour');
        initTourState();

        // 确保文件列表已加载
        if (items.value.length > 0) {
            // 延迟一点确保所有元素都已渲染
            setTimeout(() => {
                startUserTour();
            }, 300);
        }
    } else if (needsResume) {
        // 刷新后恢复导览
        const progress = getTourProgress();
        if (progress) {
            const { currentStep } = progress;

            // 步骤 1-3 需要在 /file 页面
            if (currentStep >= 0 && currentStep <= 2) {
                if (currentPath === '/file') {
                    // 在正确页面，恢复导览
                    if (items.value.length > 0) {
                        setTimeout(() => {
                            resumeTourFromStep(currentStep);
                        }, 300);
                    }
                } else {
                    // 不在正确页面，跳转（路由守卫会处理）
                    router.push('/file');
                }
            }
            // 步骤 4 由 TaskBanner 处理，不需要在这里处理
            // 步骤 5 可以在任何页面，由 TaskBanner 处理
        }
    }

    stopPolling();

    // 启动定期检查导览状态（每500ms检查一次）
    tourStateCheckInterval = setInterval(() => {
        checkTourState();
    }, 500);

    // 监听 storage 事件，实时响应 localStorage 变化（跨标签页）
    window.addEventListener('storage', handleStorageChange);

    // 监听自定义事件，用于同标签页内的状态同步
    window.addEventListener('tour-step-changed', handleTourStepChanged);
})

// 处理 storage 事件（跨标签页）
function handleStorageChange(e: StorageEvent) {
    if (e.key === 'tour_current_step' || e.key === 'tour_status' || e.key === 'tour_in_progress') {
        checkTourState();
    }
}

// 处理自定义事件（同标签页）
function handleTourStepChanged() {
    checkTourState();
}

// 组件卸载时清理
onUnmounted(() => {
    stopPolling();
    if (tourStateCheckInterval) {
        clearInterval(tourStateCheckInterval);
        tourStateCheckInterval = null;
    }
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('tour-step-changed', handleTourStepChanged);
})

// 加载当前目录内容
async function loadDirectoryContent() {
    try {
        let response;
        if (currentDirectoryId.value) {
            // 已有目录ID时获取内容
            response = await axios.get(`/directories/${currentDirectoryId.value}/contents/`, {
                headers: headers.value
            });
        } else {
            // 使用新的根目录专用接口
            response = await axios.get('/directories/root_contents/', {
                headers: headers.value
            });
            if (response.data.id) {
                rootDirectoryId.value = response.data.id;

                // 仅在根目录时初始化面包屑
                if (breadcrumb.value.length === 0) {
                    breadcrumb.value = [{
                        id: rootDirectoryId.value,
                        name: response.data.root_name || '根目录'
                    }];
                }
            }
        }

        // 处理响应数据（保持原逻辑）
        const directory = Array.isArray(response.data.directory)
            ? response.data.directory.map((dir: any) => ({
                id: dir.id,
                name: dir.name,
                node_type: 'directory',
                created_at: dir.created_at,
            }))
            : [];

        const files = Array.isArray(response.data.files)
            ? response.data.files.map((file: any) => ({
                id: file.id,
                name: file.name,
                node_type: 'file',
                size: file.size,
                parse_status: file.parse_status,
                error_message: file.error_message,
                size_display: formatFileSize(file.size),
                uploaded_at: file.uploaded_at,
                content_type: file.content_type
            }))
            : [];

        items.value = [...directory, ...files];
    } catch (error: unknown) {
        console.error(error);
        // 类型安全的错误处理
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number, data?: { message?: string } } }
            const status = axiosError.response?.status

            if (status === 401) {
                ElMessage.info('未认证，请登录后重试');
            } else {
                const message = axiosError.response?.data?.message || '加载文件失败'
                ElMessage.error(message);
            }
        } else {
            ElMessage.error('加载文件失败');
        }
    }
}

// 导航到指定目录
function navigateTo(dirId: string | null) {
    // 找到点击的面包屑索引
    const index = breadcrumb.value.findIndex(item => item.id === dirId);

    if (index !== -1) {
        // 截断到点击的面包屑项
        breadcrumb.value = breadcrumb.value.slice(0, index + 1);
        currentDirectoryId.value = dirId;
        loadDirectoryContent();
    } else if (dirId === rootDirectoryId.value) {
        // 处理根目录点击
        breadcrumb.value = breadcrumb.value.slice(0, 1);
        currentDirectoryId.value = null;
        loadDirectoryContent();
    }
}


// 节点点击处理
function handleNodeClick(node: FileItem) {
    // 点击文件名即切换该行选中状态
    const isSelected = selectedItems.value.some((item) => item.id === node.id)
    fileTableRef.value?.toggleRowSelection(node, !isSelected)
    if (node.node_type === 'directory') {
        // 重置全局搜索状态
        isGlobalSearch.value = false;
        searchQuery.value = '';

        // 更新面包屑：添加当前目录
        breadcrumb.value.push({
            id: node.id,
            name: node.name
        });

        currentDirectoryId.value = node.id;
        loadDirectoryContent();
    }
}

// 显示创建文件夹对话框
function showCreateFolderDialog() {
    if (!can('file.write')) return
    createFolderDialog.value = true
    newFolderName.value = ''
}

// 创建文件夹
async function createFolder() {
    try {
        // 确定父目录ID：
        // - 如果在根目录视图：使用根目录ID (6)
        // - 如果在子目录：使用当前目录ID
        const parentId = currentDirectoryId.value
            ? currentDirectoryId.value
            : rootDirectoryId.value;

        if (!parentId) {
            ElMessage.error('无法确定父目录');
            return;
        }

        await axios.post('/directories/', {
            name: newFolderName.value,
            parent: parentId
        }, { headers: headers.value });

        ElMessage.success('文件夹创建成功');
        createFolderDialog.value = false;
        await loadDirectoryContent();
    } catch (error) {
        ElMessage.error('文件夹创建失败');
        console.error(error);
    }
}

// 移动：加载目录树（供对话框使用）
async function loadDirectoryTree() {
    try {
        const res = await axios.get('/directories/tree/', { headers: headers.value })
        const tree = res.data
        moveTreeData.value = tree && tree.id != null ? [tree] : []
    } catch (error) {
        ElMessage.error('加载目录树失败')
        console.error(error)
        moveTreeData.value = []
    }
}

function openMoveDialog(item?: FileItem) {
    moveSingleItem.value = item ?? null
    moveDialog.value = true
    targetDirectoryId.value = null
}

function onMoveDialogOpen() {
    targetDirectoryId.value = null
    moveTreeData.value = []
    loadDirectoryTree()
    nextTick(() => {
        moveTreeRef.value?.setCurrentKey(undefined)
    })
}

function onMoveDialogClose() {
    targetDirectoryId.value = null
    moveTreeData.value = []
}

function onMoveTreeSelect(data: { id?: number }, _node: unknown) {
    if (data?.id != null) targetDirectoryId.value = String(data.id)
}

async function executeMoveAction() {
    const targetId = targetDirectoryId.value
    if (targetId == null) return
    const items = selectedItems.value.length ? selectedItems.value : moveSingleItem.value ? [moveSingleItem.value] : []
    if (!items.length) {
        moveDialog.value = false
        return
    }
    const fileIds = items.filter((i) => i.node_type === 'file').map((i) => Number(i.id))
    const directoryIds = items.filter((i) => i.node_type === 'directory').map((i) => Number(i.id))
    const rootId = rootDirectoryId.value != null ? Number(rootDirectoryId.value) : null
    const targetDirIdForApi = rootId !== null && targetId === String(rootId) ? null : Number(targetId)

    try {
        const promises: Promise<unknown>[] = []
        if (fileIds.length) {
            promises.push(
                axios.post('/files/batch_move/', {
                    file_ids: fileIds,
                    target_directory_id: Number(targetId),
                }, { headers: headers.value })
            )
        }
        if (directoryIds.length) {
            promises.push(
                axios.post('/directories/batch_move/', {
                    directory_ids: directoryIds,
                    target_directory_id: targetDirIdForApi,
                }, { headers: headers.value })
            )
        }
        if (promises.length) {
            await Promise.all(promises)
            ElMessage.success('移动成功')
            moveDialog.value = false
            moveSingleItem.value = null
            selectedItems.value = []
            await loadDirectoryContent()
        }
    } catch (error: unknown) {
        const msg = error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
            : '移动失败'
        ElMessage.error(msg || '移动失败')
        console.error(error)
    }
}

// 文件下载
async function downloadFile(fileId: string) {
    // 检查是否在导览步骤2或步骤3，如果是则阻止下载
    if (shouldDisableDownloadAndDelete.value) {
        ElMessage.warning('导览进行中，请先完成导览步骤');
        return;
    }

    try {
        const response = await fetchWithAuth(`/files/${fileId}/download/`);
        if (!response.ok) {
            throw new Error(`下载失败（${response.status}）`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // 从Content-Disposition头获取文件名
        const contentDisposition = response.headers.get('content-disposition') || '';
        let fileName = 'file'; // 默认文件名

        // 优先解析 RFC 5987 格式 (filename*=)
        const rfc5987Match = contentDisposition.match(/filename\*=utf-8''([^;]+)/i);
        if (rfc5987Match && rfc5987Match[1]) {
            // URL 解码文件名
            fileName = decodeURIComponent(rfc5987Match[1]);
        }
        // 如果没有 RFC 5987 格式，尝试解析传统格式
        else {
            const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
            if (fileNameMatch && fileNameMatch[1]) {
                fileName = decodeURIComponent(fileNameMatch[1]);
            }
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        ElMessage.error('文件下载失败');
        console.error(error);
    }
}

// 删除项目
async function deleteItem(item: FileItem) {
    // 检查是否在导览步骤2或步骤3，如果是则阻止删除
    if (shouldDisableDownloadAndDelete.value) {
        ElMessage.warning('导览进行中，请先完成导览步骤');
        return;
    }

    try {
        if (item.node_type === 'directory') {
            await axios.delete(`/directories/${item.id}/`, { headers: headers.value });
        } else {
            await axios.delete(`/files/${item.id}/`, { headers: headers.value });
        }

        ElMessage.success('删除成功');
        await loadDirectoryContent();
    } catch (error) {
        ElMessage.error('删除失败');
        console.error(error);
    }
}


// 批量操作
function handleSelectionChange(selection: FileItem[]) {
    selectedItems.value = selection
}

// 执行批量操作
function executeBatchAction(action: string) {
    if (!can('file.write')) return;
    if (action === 'parse') {
        batchParse();
    } else if (action === 'cancel') {
        batchCancel();
    } else if (action === 'delete') {
        batchDelete()
    } else if (action === 'move') {
        moveSingleItem.value = null
        moveDialog.value = true
        targetDirectoryId.value = null
    }
    batchAction.value = ''
}

// 批量删除
async function batchDelete() {
    if (!selectedItems.value.length) return;

    try {
        const deletePromises = selectedItems.value.map(item => {
            if (item.node_type === 'directory') {
                return axios.delete(`/directories/${item.id}/`, { headers: headers.value });
            } else {
                return axios.delete(`/files/${item.id}/`, { headers: headers.value });
            }
        });

        await Promise.all(deletePromises);
        ElMessage.success(`成功删除 ${selectedItems.value.length} 个项目`);
        selectedItems.value = [];
        await loadDirectoryContent();
    } catch (error) {
        ElMessage.error('批量删除失败');
        console.error(error);
    }
}


async function performGlobalSearch(query: string) {
    try {
        const response = await axios.get('/files/search/', {
            params: { q: query },
            headers: headers.value
        });

        // 处理搜索结果
        return [
            ...response.data.directories.map((dir: any) => ({
                id: dir.id,
                name: dir.name,
                node_type: 'directory',
                created_at: dir.created_at,
                path: dir.path // 添加路径信息
            })),
            ...response.data.files.map((file: any) => ({
                id: file.id,
                name: file.name,
                node_type: 'file',
                size: file.size,
                size_display: formatFileSize(file.size),
                uploaded_at: file.uploaded_at,
                content_type: file.content_type,
                parse_status: file.parse_status,
                error_message: file.error_message,
                path: file.directory_name
            }))
        ];
    } catch (error) {
        ElMessage.error('搜索失败');
        console.error(error);
        return [];
    }
}

// 添加日期格式化函数
function formatDateTime(dateString: string): string {
    if (!dateString) return '';

    const date = new Date(dateString);

    // 确保日期有效
    if (isNaN(date.getTime())) return '';

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}


const parseDialogVisible = ref(false);
const activeTaskGroupIds = ref<string[]>([]);
const completedTasks = ref(0);
const totalTasks = ref(0);
const taskDetails = ref<any[]>([]);
const pollingInterval = ref<NodeJS.Timeout | null>(null);
const isProcessing = ref(false);

// 计算属性
const parseProgressPercentage = computed(() => {
    return totalTasks.value > 0 ? Math.round((completedTasks.value / totalTasks.value) * 100) : 0;
});

const showParseProgressEntry = computed(() => isProcessing.value && !parseDialogVisible.value);

const parseDialogCloseText = computed(() => isProcessing.value ? '后台继续' : '关闭');

const parseStatus = computed<'' | 'success' | 'warning' | 'exception'>(() => {
    if (parseProgressPercentage.value === 100) return 'success';
    if (isProcessing.value) return 'warning';
    return parseProgressPercentage.value > 0 ? 'exception' : '';
});

const parseStatusText = computed(() => {
    if (parseProgressPercentage.value === 100) return '解析完成';
    return isProcessing.value ? '处理中...' : '等待开始';
});

function handleParseDialogClose() {
    const isTaskRunning = isProcessing.value;
    parseDialogVisible.value = false;

    if (isTaskRunning) {
        ElMessage.info('解析任务正在后台继续，可通过“解析中任务”入口查看进度');
    }
}

function reopenParseDialog() {
    parseDialogVisible.value = true;
}

async function parseSingleFile(fileItem: FileItem) {
    // 确保是文件类型
    if (fileItem.node_type !== 'file') {
        ElMessage.warning('请选择文件进行解析');
        return;
    }

    // 检查是否在导览步骤2，如果是则阻止解析
    if (isTourStep2.value) {
        ElMessage.warning('导览进行中，请先完成当前步骤');
        return;
    }

    // 调用解析方法，传入单个文件ID，直接解析（不弹窗）
    await submitParseTask([fileItem.id]);

    // 如果在导览步骤三，解析开始后销毁导览并保存进度
    const progress = getTourProgress();
    const isStep3 = progress?.currentStep === 2; // 步骤三对应索引2
    if (isStep3) {
        const { destroyUserTour } = await import('../../utils/userTour');
        // 保存进度到步骤3（索引2），表示用户已点击解析，等待解析完成
        // 解析完成后，TaskBanner 会检测到新任务并触发步骤4
        saveTourProgress(2);
        sessionStorage.setItem('tour_in_progress', 'true');
        destroyUserTour();
    }
}

// 批量解析方法
async function batchParse() {
    // 只筛选文件类型
    const selectedFiles = selectedItems.value.filter(item => item.node_type === 'file');

    if (selectedFiles.length === 0) {
        ElMessage.warning('请选择至少一个文件进行解析');
        return;
    }

    // 直接调用共用的解析方法（不弹窗）
    await submitParseTask(selectedFiles.map(file => file.id));
}

// 处理单个文件的密码补填（由任务详情表单中的“输入密码”按钮触发）
function handleNeedsPassword(row: any) {
    passwordForm.value = [{ id: row.file_id, name: row.file_name, password: '' }];
    passwordDialogVisible.value = true;
}

// 确认解析（带密码）
async function confirmParseWithPassword() {
    passwordDialogVisible.value = false;

    const fileIds = passwordForm.value.map(item => item.id);
    const passwords: Record<string, string> = {};
    passwordForm.value.forEach(item => {
        if (item.password) {
            passwords[item.id] = item.password;
        }
    });

    const isStep3 = getTourProgress()?.currentStep === 2;

    await submitParseTask(fileIds, passwords, true);

    // 如果在导览步骤三，解析开始后销毁导览并保存进度
    if (isStep3) {
        const { destroyUserTour } = await import('../../utils/userTour');
        // 保存进度到步骤3（索引2），表示用户已点击解析，等待解析完成
        // 解析完成后，TaskBanner 会检测到新任务并触发步骤4
        saveTourProgress(2);
        sessionStorage.setItem('tour_in_progress', 'true');
        destroyUserTour();
    }
}

async function submitParseTask(fileIds: string[], passwords?: Record<string, string>, isPasswordRetry: boolean = false) {
    try {
        const payload: any = { file_ids: fileIds };
        if (passwords && Object.keys(passwords).length > 0) {
            payload.passwords = passwords;
        }

        const response = await axios.post('/translate/multi', payload, { headers: headers.value });

        // 处理任务状态（保持原有逻辑）
        if (response.status === 202) {
            if (isPasswordRetry) {
                activeTaskGroupIds.value.push(response.data.task_group_id);
                fileIds.forEach(id => {
                    const task = taskDetails.value.find(t => t.file_id === id);
                    if (task) {
                        task.status = 'pending';
                        task.error = undefined;
                    }
                });
            } else {
                activeTaskGroupIds.value = [response.data.task_group_id];
                totalTasks.value = fileIds.length;
                completedTasks.value = 0;

                // 构建任务详情（兼容全局搜索模式）
                taskDetails.value = fileIds.map(id => {
                    // 在文件列表中查找对应文件
                    const file = items.value.find(item => item.id === id) ||
                        globalSearchResults.value.find(item => item.id === id);
                    return {
                        file_id: id,
                        file_name: file ? file.name : id,
                        status: 'pending'
                    };
                });
            }

            parseDialogVisible.value = true;
            startPollingTaskStatus();
        }
    } catch (error: any) {
        // 错误处理（保持原有逻辑）
        if (error.response?.status === 400) {
            const pendingFiles = error.response.data.pending_files || [];
            const pendingFileNames = pendingFiles.map((id: string) => {
                const file = items.value.find(f => f.id === id) ||
                    globalSearchResults.value.find(f => f.id === id);
                return file ? file.name : id;
            });
            ElMessage.error(`部分文件已在处理中：${pendingFileNames.join(', ')}`);
        } else {
            ElMessage.error('提交解析任务失败');
        }
        console.error(error);
    }
}

// 批量取消解析
async function batchCancel() {
    // 只筛选文件类型
    const selectedFiles = selectedItems.value.filter(item => item.node_type === 'file');

    if (selectedFiles.length === 0) {
        ElMessage.warning('请选择至少一个文件进行取消解析');
        return;
    }

    // 筛选出可以取消的文件（pending/processing/parsed状态）
    const cancellableFiles = selectedFiles.filter(file =>
        ['pending', 'processing', 'parsed'].includes(file.parse_status || '')
    );

    if (cancellableFiles.length === 0) {
        ElMessage.warning('所选文件中没有可以取消解析的文件');
        return;
    }

    if (cancellableFiles.length < selectedFiles.length) {
        ElMessage.warning(`部分文件无法取消解析，将处理 ${cancellableFiles.length} 个文件`);
    }

    // 调用取消解析方法
    await cancelParse(cancellableFiles.map(file => file.id));
}

// 取消解析
async function cancelParse(fileIds: string[]) {
    try {
        const response = await axios.post('/translate/cancel', {
            file_ids: fileIds
        }, { headers: headers.value });

        ElMessage.success(response.data.message || '已取消解析');
        await loadDirectoryContent();
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '取消解析失败');
        console.error(error);
    }
}

// 取消单个文件解析（或清除已解析文件的内容）
async function cancelSingleFile(fileItem: FileItem) {
    if (fileItem.node_type !== 'file') {
        ElMessage.warning('只能取消文件的解析');
        return;
    }

    // 检查是否在导览步骤2，如果是则阻止取消解析
    if (isTourStep2.value) {
        ElMessage.warning('导览进行中，请先完成当前步骤');
        return;
    }

    if (!['pending', 'processing', 'parsed'].includes(fileItem.parse_status || '')) {
        ElMessage.warning('只能取消待解析、解析中或已解析的文件');
        return;
    }

    if (fileItem.parse_status === 'parsed') {
        try {
            await ElMessageBox.confirm(
                `将清除文件“${fileItem.name}”的解析结果，是否继续？`,
                '确认清除解析结果',
                {
                    confirmButtonText: '确认',
                    cancelButtonText: '取消',
                    type: 'warning',
                }
            );
        } catch {
            return;
        }
    }

    await cancelParse([fileItem.id]);
}

// 开始轮询任务状态
function startPollingTaskStatus() {
    isProcessing.value = true;

    if (pollingInterval.value) {
        clearInterval(pollingInterval.value);
    }

    pollingInterval.value = setInterval(async () => {
        try {
            if (activeTaskGroupIds.value.length === 0) return;

            // 并发请求所有 active 组的状态
            const promises = activeTaskGroupIds.value.map(groupId =>
                axios.get('/translate/task_group_status', {
                    params: { task_group_id: groupId },
                    headers: headers.value
                }).catch(e => null)
            );
            const responses = await Promise.all(promises);

            const allTasks: any[] = [];
            responses.forEach(res => {
                if (res && res.data && res.data.tasks) {
                    allTasks.push(...res.data.tasks);
                }
            });

            completedTasks.value = 0;
            let hasNewPendingReview = false;

            // 更新任务状态
            taskDetails.value = taskDetails.value.map(task => {
                const taskStatuses = allTasks.filter(t => t.file_id === task.file_id);
                if (taskStatuses.length > 0) {
                    const taskStatus = taskStatuses[taskStatuses.length - 1]; // 取最后也就是最新的
                    const oldStatus = task.status;
                    const newStatus = taskStatus.status;

                    // 检测是否有新进入 pending_review 状态的任务
                    if (oldStatus !== 'pending_review' && newStatus === 'pending_review') {
                        hasNewPendingReview = true;
                    }

                    // pending_review 表示解析已完成，只是需要审核，应该计入已完成
                    if (['parsed', 'failed', 'cancelled', 'pending_review'].includes(newStatus)) {
                        completedTasks.value++;
                    }
                    return { ...task, status: newStatus, error: taskStatus.error ?? task.error };
                }

                if (['parsed', 'failed', 'cancelled', 'pending_review'].includes(task.status)) {
                    completedTasks.value++;
                }
                return task;
            });

            // 如果有新任务进入待审核状态，触发横幅更新
            if (hasNewPendingReview) {
                emitTaskBannerRefresh();
            }

            // 检查任务组是否完成
            // 如果所有任务都是已完成状态（包括 pending_review），则关闭弹窗
            const allTasksCompleted = taskDetails.value.every((task: any) =>
                ['parsed', 'failed', 'cancelled', 'pending_review'].includes(task.status)
            );

            if (allTasksCompleted) {
                stopPolling();
                ElMessage.success('所有文件解析完成');

                // 注意：导览步骤由横幅更新时自动触发，不需要在这里调用
                // 横幅更新会检测到新任务并触发导览步骤4（立即处理按钮）

                setTimeout(() => {
                    parseDialogVisible.value = false;
                    // 刷新文件列表
                    loadDirectoryContent();
                }, 2000);
            }
        } catch (error) {
            console.error('获取任务状态失败', error);
        }
    }, 2000); // 每2秒轮询一次
}

// 停止轮询
function stopPolling() {
    if (pollingInterval.value) {
        clearInterval(pollingInterval.value);
        pollingInterval.value = null;
    }
    isProcessing.value = false;
}

// 状态标签类型
function statusTagType(status: string): TagProps['type'] {
    switch (status) {
        case 'parsed':
            return 'success'
        case 'failed':
            return 'danger'
        case 'processing':
            return 'primary'
        case 'pending':
            return 'warning'
        case 'cancelled':
            return 'info'
        case 'needs_password':
            return 'warning'
        default:
            return 'info' // 其他状态
    }
}


// 状态翻译函数
function translateStatus(status: string | undefined): string {
    if (!status) return '-';
    const statusMap: Record<string, string> = {
        'unprocessed': '未解析',
        'pending': '待解析',
        'processing': '解析中',
        'parsed': '已解析',
        'failed': '解析失败',
        'cancelled': '取消解析',
        'pending_review': '待审核',
        'needs_password': '需要密码'
    };
    return statusMap[status] || status;
}

function getStatusColor(status: string | undefined): TagProps['type'] {
    if (!status) return 'info'

    const statusMap: Record<string, TagProps['type']> = {
        unprocessed: 'info',
        pending: 'primary',
        processing: 'warning',
        parsed: 'success',
        failed: 'danger',
        cancelled: 'info',
        needs_password: 'warning'
    }

    return statusMap[status] || 'info'
}

</script>

<style scoped>
.upload-progress-container {
    margin-top: 10px;
    margin-bottom: 20px;
    width: 100%;
    max-width: 400px;
}

.file-management {
    padding: 20px;
    background-color: var(--el-bg-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    animation: fadeIn 0.6s ease;
}

.path-display {
    margin-bottom: 15px;
    font-size: 14px;
    color: var(--el-text-color-regular);
    padding: 10px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: nowrap;
}

.toolbar-primary-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.batch-select {
    width: 140px;
}

.search-input {
    width: 400px;
    min-width: 200px;
    margin-left: auto;
    flex-shrink: 0;
}

.flex {
    display: flex;
    align-items: center;
}

.cursor-pointer {
    cursor: pointer;
}

.file-table {
    transition: all 0.3s ease;
}

.file-table:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.directory-tree {
    max-height: 400px;
    overflow-y: auto;
}

.text-right {
    text-align: right;
    margin-top: 20px;
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

.task-info {
    margin: 15px 0;
    line-height: 1.8;
}

.upload-hint-banner {
    margin-bottom: 16px;
    padding: 12px 16px;
    border: 1px solid var(--el-color-warning-light-5);
    border-radius: 8px;
    background: var(--el-color-warning-light-9);
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.upload-hint-banner__icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--el-color-warning);
}

.upload-hint-banner__content {
    flex: 1;
    min-width: 0;
}

.upload-hint-banner__lead {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--el-text-color-primary);
}

.upload-hint-banner__tip {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-color-warning-dark-2);
}

.upload-hint-banner__inline-link {
    font-size: inherit;
    vertical-align: baseline;
}

.sample-cleanup-banner {
    margin-bottom: 16px;
    padding: 12px 16px;
    border: 1px solid var(--el-color-info-light-5);
    border-radius: 8px;
    background: var(--el-color-info-light-9);
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.sample-cleanup-banner__icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--el-color-info);
}

.sample-cleanup-banner__content {
    flex: 1;
    min-width: 0;
}

.sample-cleanup-banner__lead {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--el-text-color-primary);
}

.sample-cleanup-banner__meta {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
}

.sample-cleanup-banner__route-link {
    color: var(--el-color-primary);
    text-decoration: none;
}

.sample-cleanup-banner__route-link:hover {
    text-decoration: underline;
}

.sample-cleanup-banner__inline-link {
    font-size: inherit;
    vertical-align: baseline;
}

.sample-file-tag {
    margin-left: 8px;
    flex-shrink: 0;
}

.parse-progress-entry {
    margin-bottom: 20px;
    padding: 14px 16px;
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: 8px;
    background: var(--el-color-primary-light-9);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.parse-progress-entry__content {
    min-width: 0;
}

.parse-progress-entry__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.parse-progress-entry__meta {
    margin-top: 4px;
    font-size: 13px;
    color: var(--el-text-color-regular);
}

.parse-failed-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    cursor: default;
}

.file-table-dropzone {
    position: relative;
    min-height: 200px;
}

.drop-overlay {
    position: absolute;
    inset: 0;
    background-color: var(--el-fill-color-extra-light);
    backdrop-filter: blur(4px);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--el-color-primary);
    border-radius: 8px;
}

.drop-overlay-content {
    text-align: center;
    color: var(--el-color-primary);
}

.drop-icon {
    margin-bottom: 10px;
}

.drop-text {
    font-size: 18px;
    font-weight: bold;
    margin: 0 0 5px 0;
}

.drop-sub-text {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
}
</style>
