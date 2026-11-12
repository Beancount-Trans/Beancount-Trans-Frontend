<template>
    <div class="tag-selector-test">
        <h2>标签选择器测试</h2>

        <div class="test-section">
            <h3>测试单选模式</h3>

            <div class="test-item">
                <h4>单选标签选择器（带预览）</h4>
                <TagSelector v-model="selectedTagSingle" placeholder="选择标签" @change="handleTagSingleChange" />
                <p>选中的标签ID: {{ selectedTagSingle }}</p>
            </div>

            <div class="test-item">
                <h4>单选标签选择器（不显示预览）</h4>
                <TagSelector v-model="selectedTagSingleNoPreview" :show-preview="false" placeholder="选择标签"
                    @change="handleTagSingleNoPreviewChange" />
                <p>选中的标签ID: {{ selectedTagSingleNoPreview }}</p>
            </div>

            <div class="test-item">
                <h4>单选标签选择器（显示所有标签包括禁用）</h4>
                <TagSelector v-model="selectedTagAll" :enabled-only="false" placeholder="选择标签"
                    @change="handleTagAllChange" />
                <p>选中的标签ID: {{ selectedTagAll }}</p>
            </div>
        </div>

        <div class="test-section">
            <h3>测试多选模式</h3>

            <div class="test-item">
                <h4>多选标签选择器（带预览）</h4>
                <TagSelector v-model="selectedTagsMultiple" multiple placeholder="选择多个标签"
                    @change="handleTagsMultipleChange" />
                <p>选中的标签IDs: {{ selectedTagsMultiple }}</p>
            </div>

            <div class="test-item">
                <h4>多选标签选择器（不显示预览）</h4>
                <TagSelector v-model="selectedTagsMultipleNoPreview" multiple :show-preview="false" placeholder="选择多个标签"
                    @change="handleTagsMultipleNoPreviewChange" />
                <p>选中的标签IDs: {{ selectedTagsMultipleNoPreview }}</p>
            </div>
        </div>

        <div class="test-section">
            <h3>测试搜索功能</h3>
            <p>尝试在选择器中输入关键词进行搜索，支持搜索标签名称、完整路径和描述（不区分大小写）</p>
        </div>

        <div class="test-section">
            <h3>调试信息</h3>
            <div class="debug-info">
                <h4>单选标签（带预览）:</h4>
                <pre>{{ JSON.stringify(selectedTagSingleData, null, 2) }}</pre>

                <h4>单选标签（不带预览）:</h4>
                <pre>{{ JSON.stringify(selectedTagSingleNoPreviewData, null, 2) }}</pre>

                <h4>单选标签（包括禁用）:</h4>
                <pre>{{ JSON.stringify(selectedTagAllData, null, 2) }}</pre>

                <h4>多选标签（带预览）:</h4>
                <pre>{{ JSON.stringify(selectedTagsMultipleData, null, 2) }}</pre>

                <h4>多选标签（不带预览）:</h4>
                <pre>{{ JSON.stringify(selectedTagsMultipleNoPreviewData, null, 2) }}</pre>
            </div>
        </div>

        <div class="test-section">
            <h3>功能按钮</h3>
            <el-button type="primary" @click="resetAllSelections">重置所有选择</el-button>
            <el-button type="success" @click="setTestValues">设置测试值</el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TagSelector from '../common/TagSelector.vue'

// 单选模式
const selectedTagSingle = ref<number | null>(null)
const selectedTagSingleNoPreview = ref<number | null>(null)
const selectedTagAll = ref<number | null>(null)

// 多选模式
const selectedTagsMultiple = ref<number[]>([])
const selectedTagsMultipleNoPreview = ref<number[]>([])

// 数据存储
const selectedTagSingleData = ref(null)
const selectedTagSingleNoPreviewData = ref(null)
const selectedTagAllData = ref(null)
const selectedTagsMultipleData = ref(null)
const selectedTagsMultipleNoPreviewData = ref(null)

// 单选处理函数
const handleTagSingleChange = (tag: any) => {
    console.log('单选标签（带预览）变化:', tag)
    selectedTagSingleData.value = tag
}

const handleTagSingleNoPreviewChange = (tag: any) => {
    console.log('单选标签（不带预览）变化:', tag)
    selectedTagSingleNoPreviewData.value = tag
}

const handleTagAllChange = (tag: any) => {
    console.log('单选标签（包括禁用）变化:', tag)
    selectedTagAllData.value = tag
}

// 多选处理函数
const handleTagsMultipleChange = (tags: any) => {
    console.log('多选标签（带预览）变化:', tags)
    selectedTagsMultipleData.value = tags
}

const handleTagsMultipleNoPreviewChange = (tags: any) => {
    console.log('多选标签（不带预览）变化:', tags)
    selectedTagsMultipleNoPreviewData.value = tags
}

// 重置所有选择
const resetAllSelections = () => {
    selectedTagSingle.value = null
    selectedTagSingleNoPreview.value = null
    selectedTagAll.value = null
    selectedTagsMultiple.value = []
    selectedTagsMultipleNoPreview.value = []

    selectedTagSingleData.value = null
    selectedTagSingleNoPreviewData.value = null
    selectedTagAllData.value = null
    selectedTagsMultipleData.value = null
    selectedTagsMultipleNoPreviewData.value = null
}

// 设置测试值（需要根据实际数据库中的标签ID调整）
const setTestValues = () => {
    // 假设数据库中有这些ID的标签，实际使用时需要调整
    selectedTagSingle.value = 1
    selectedTagSingleNoPreview.value = 2
    selectedTagAll.value = 3
    selectedTagsMultiple.value = [1, 2, 3]
    selectedTagsMultipleNoPreview.value = [4, 5]
}
</script>

<style scoped>
.tag-selector-test {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.test-section {
    margin-bottom: 30px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background-color: var(--surface);
}

.test-section h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: var(--text-primary);
    border-bottom: 2px solid var(--action);
    padding-bottom: 10px;
}

.test-item {
    margin-bottom: 20px;
    padding: 15px;
    background-color: var(--surface-hover);
    border-radius: 4px;
}

.test-item:last-child {
    margin-bottom: 0;
}

.test-item h4 {
    margin: 0 0 10px 0;
    color: var(--action);
    font-size: 14px;
}

.test-item p {
    margin: 10px 0 0 0;
    padding: 8px;
    background-color: var(--surface);
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-secondary);
}

.debug-info {
    margin-top: 15px;
}

.debug-info h4 {
    margin: 15px 0 5px 0;
    color: var(--text-secondary);
    font-size: 14px;
}

.debug-info pre {
    max-height: 200px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.4;
    background-color: var(--surface-hover);
    padding: 10px;
    border-radius: 4px;
    margin: 5px 0;
    border: 1px solid var(--border);
}

.test-section .el-button {
    margin-right: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .tag-selector-test {
        padding: 10px;
    }

    .test-section {
        padding: 15px;
    }

    .test-item {
        padding: 10px;
    }
}
</style>
