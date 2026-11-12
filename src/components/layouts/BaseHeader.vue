<template>
  <el-menu class="el-menu-demo" mode="horizontal" :ellipsis="false" :default-active="activeMenuIndex"
    :key="`${activeMenuIndex}-${menuRenderKey}`" @select="handleSelect">
    <router-link v-for="item in topNav" :key="item.key" :to="item.to" class="no-underline">
      <el-menu-item :index="item.to" :id="item.id">
        <el-icon v-if="!can(item.capability)" class="nav-lock">
          <Lock />
        </el-icon>
        {{ item.label }}
      </el-menu-item>
    </router-link>

    <el-sub-menu index="config">
      <template #title>
        <el-icon v-if="!can('config.read')" class="nav-lock">
          <Lock />
        </el-icon>
        解析配置
      </template>
      <router-link v-for="item in configNav" :key="item.to" :to="item.to" class="no-underline">
        <el-menu-item :index="item.to">{{ item.label }}</el-menu-item>
      </router-link>
    </el-sub-menu>

    <div class="flex-grow" />

    <el-menu-item index="theme-toggle" class="theme-toggle">
      <el-switch v-model="isDark" size="small" inline-prompt :active-icon="Moon" :inactive-icon="Sunny" active-text="夜间"
        inactive-text="日间" />
    </el-menu-item>

    <el-menu-item index="github-star">
      <el-link href="https://github.com/Beancount-Trans/Beancount-Trans" target="_blank"
        style="display: inline-flex; align-items: center;"> <img
          src="https://img.shields.io/github/stars/Beancount-Trans/Beancount-Trans?style=social" alt="GitHub stars"
          style="height: 30px; margin-left: 6px; vertical-align: middle;" />
      </el-link>
    </el-menu-item>

    <template v-if="isGuest">
      <el-menu-item index="guest-tier">
        <el-tag size="small" type="info" effect="plain">游客 · 解析模式</el-tag>
      </el-menu-item>
      <el-menu-item index="login" @click="goLogin">登录 / 注册</el-menu-item>
    </template>

    <el-sub-menu v-else index="manager" popper-class="user-menu-dropdown">
      <template #title>
        <span class="identity-name">{{ username }}</span>
      </template>
      <router-link to="/tasks" class="no-underline">
        <el-menu-item index="/tasks">待办列表</el-menu-item>
      </router-link>
      <el-menu-item index="fava" @click="openFavaInstance">打开 Fava</el-menu-item>
      <el-menu-item index="tutorial">
        <a href="https://trans.dhr2333.cn/docs/%E6%95%99%E7%A8%8B/quick-start/" class="help-link" target="_blank">教程</a>
      </el-menu-item>
      <router-link to="/settings" class="no-underline">
        <el-menu-item index="/settings">个人设置</el-menu-item>
      </router-link>
      <el-menu-item index="logout" @click="cleanToken">退出登录</el-menu-item>
    </el-sub-menu>
  </el-menu>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import { Lock, Moon, Sunny } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import router from '~/routers'
import { isDark } from '~/composables'
import { useCapabilities } from '~/capabilities'
import type { Capability } from '~/capabilities'
import { clearAuthTokens } from '~/utils/auth'

interface NavItem {
  key: string
  label: string
  to: string
  capability: Capability
  id?: string
}

const route = useRoute()
const { can, isGuest, username, refresh } = useCapabilities()

const activeMenuIndex = computed(() => {
  if (route.path.startsWith('/assistant')) {
    return '/assistant'
  }
  return route.path
})
const menuRenderKey = ref(0)

const topNav: NavItem[] = [
  { key: 'assistant', label: 'Copilot', to: '/assistant', capability: 'assistant.use', id: 'tour-ledger-menu' },
  { key: 'trans', label: '账单解析', to: '/trans', capability: 'ledger.parse' },
  { key: 'file', label: '文件管理', to: '/file', capability: 'file.read' },
]

const configNav = [
  { to: '/config/accounts', label: '账本账户' },
  { to: '/config/mappings', label: '关键字映射' },
  { to: '/config/tags', label: '标签管理' },
  { to: '/format', label: '输出配置' },
]

const FAVA_STOP_PATH = '/fava/stop/'

const goLogin = () => {
  router.push('/login')
}

/**
 * 清除令牌并退出登录
 */
const cleanToken = async () => {
  try {
    if (can('fava.use')) {
      try {
        // 由 request 拦截器附加 JWT，勿手写 Authorization
        await axios.post(FAVA_STOP_PATH, {})
        console.log('Fava实例已停止')
      } catch (error: unknown) {
        console.warn('停止Fava实例时出错:', error)
      }
    }
  } catch (error: unknown) {
    console.warn('退出登录时出错:', error)
  } finally {
    clearAuthTokens()
    document.cookie = 'csrftoken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    document.cookie = 'sessionid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    router.push('/login')
  }
}

/**
 * 新标签打开（若被拦截则提示，但不跳转当前页）
 */
const openInNewTab = (url: string) => {
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    return false
  }
  return true
}

const handleSelect = (_key: string, _keyPath: string[]) => {
  // 预留扩展点
}

/**
 * 打开 Fava 实例
 */
const openFavaInstance = async () => {
  if (!can('fava.use')) {
    ElMessage.info('登录后可用')
    goLogin()
    return
  }

  const loading = ElLoading.service({
    lock: true,
    text: '正在为您生成专属加密空间，请稍候',
  })

  try {
    const response = await axios.get(`/fava/`, {
      withCredentials: true,
    })

    const data = response.data as { url?: string; deploy_mode?: string } | undefined
    if (response.status === 200 && data?.url && data.deploy_mode === 'static') {
      const opened = openInNewTab(data.url)
      if (opened) ElMessage.success('已在新标签打开 Fava，关闭标签即可返回平台')
      return
    }

    if (response.status === 200 && response.request.responseURL) {
      const redirectPath = response.request.responseURL
      const newUrl = new URL(redirectPath, window.location.origin)
      const opened = openInNewTab(newUrl.toString())
      if (opened) ElMessage.success('已在新标签打开 Fava，关闭标签即可返回平台')
    } else {
      throw new Error('未收到重定向响应')
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response?: { status?: number; data?: { error?: string; code?: string } }
      }
      if (axiosError.response?.status === 401) {
        ElMessage.info('未认证，请登录后重试')
      } else if (axiosError.response?.status === 404 && axiosError.response.data?.code === 'FAVA_STATIC_NOT_CONFIGURED') {
        ElMessage.error(axiosError.response.data?.error || '未配置静态 Fava 入口')
      } else {
        ElMessage.error('加载账本失败')
      }
    } else {
      ElMessage.error('网络错误，请稍后重试')
      console.error('打开Fava实例失败:', error)
    }
  } finally {
    loading.close()
    menuRenderKey.value += 1
  }
}

// 登录态变化后刷新仓库状态，由能力层事件统一触发
void refresh()
</script>

<style scoped lang="scss">
.flex-grow {
  flex-grow: 1;
}

.nav-lock {
  margin-right: 2px;
  font-size: 12px;
}

.help-link {
  display: block;
  height: 100%;
  width: 100%;
  color: inherit;
  text-decoration: none;
}

.identity-name {
  margin-right: 6px;
}

.theme-toggle {
  display: flex;
  align-items: center;

  .el-switch {
    --el-switch-on-color: var(--action);
    --el-switch-off-color: var(--el-fill-color-dark);
  }
}
</style>

<!-- 全局样式：下拉框样式优化，防止出现滚动条 -->
<style lang="scss">
.user-menu-dropdown {
  width: 160px !important;
  min-width: 160px !important;
  max-width: 160px !important;

  overflow: hidden !important;
  max-height: none !important;

  .el-menu {
    width: 100%;
    min-width: 100%;
    border: none;
    overflow: hidden;
  }

  .el-menu-item {
    display: flex;
    align-items: center;
    padding: 0 10px !important;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
