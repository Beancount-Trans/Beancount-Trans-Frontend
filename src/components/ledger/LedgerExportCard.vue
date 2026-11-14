<template>
  <el-card shadow="never" class="ledger-export-card">
    <template #header>
      <div class="card-header">
        <el-icon class="header-icon">
          <Download />
        </el-icon>
        <div>
          <div class="title-row">
            <h3>导出账本</h3>
          </div>
          <el-text type="info" size="small">直接打包当前账本，随时可在本地打开。</el-text>
        </div>
      </div>
    </template>

    <div class="intro-content">
      <p class="export-desc">
        打包当前账本（main.bean 与 trans/ 解析结果）为 ZIP，可直接用 Fava 或本地 Beancount 打开。
      </p>
      <div class="action-buttons">
        <el-button type="primary" size="large" :loading="exporting" @click="handleExport">
          <el-icon>
            <Download />
          </el-icon>
          下载账本 ZIP
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script lang="ts" setup>
import { Download } from '@element-plus/icons-vue'
import { useLedgerExport } from '../../composables/useLedgerExport'

const { exporting, handleExport } = useLedgerExport()
</script>

<style scoped>
.ledger-export-card {
  max-width: 800px;
  margin: 0 auto 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: var(--action);
  font-size: 24px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.intro-content {
  padding: 0 8px;
}

.export-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
}
</style>
