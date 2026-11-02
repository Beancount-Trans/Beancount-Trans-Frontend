import { createRouter, createWebHistory } from 'vue-router'
import { hasAuthTokens } from './utils/auth'

// 引入组件
import Trans from "./components/trans/Trans.vue"
import Format from "./components/map/Format.vue"
import FileManage from "./components/file/FileManage.vue"
import AccountManagement from "./components/config/AccountManagement.vue"
import TagManagement from "./components/config/TagManagement.vue"
import MappingManagement from "./components/map/MappingManagement.vue"
import Login from "./views/login/index.vue"
import PhoneBinding from "./views/phone-binding/index.vue"
import Settings from "./views/settings/index.vue"
import AuthenticateByGithubToken from './components/GitHubCallback.vue';
// 模板管理
import AccountTemplates from "./components/template/AccountTemplates.vue"
import MappingTemplates from "./components/template/MappingTemplates.vue"
// 对账功能
import ReconciliationList from "./views/reconciliation/ReconciliationList.vue"
import ReconciliationForm from "./views/reconciliation/ReconciliationForm.vue"
// 条目审核功能
import ParseReviewForm from "./views/parse-review/ParseReviewForm.vue"
// Copilot
import AssistantView from "./views/assistant/AssistantView.vue"

// 配置路由
const router = createRouter({
  // 内部提供了 history 模式的实现。为了简单起见，我们在这里使用 hash 模式。
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: "index",
      // 根路径：已登录进入文件管理，未登录进入解析页（解析支持匿名使用）
      redirect: () => (hasAuthTokens() ? '/file' : '/trans')
    },
    { path: '/auth/github/token', component: AuthenticateByGithubToken },
    { path: '/trans', name: "trans", component: Trans },
    { path: '/format', name: "format", component: Format },
    { path: '/file', name: "filemanage", component: FileManage },
    { path: '/config/accounts', name: "accountManagement", component: AccountManagement },
    { path: '/config/tags', name: "tagManagement", component: TagManagement },
    { path: '/config/mappings', name: "mappingManagement", component: MappingManagement },
    // 模板管理
    { path: '/template/accounts', name: "accountTemplates", component: AccountTemplates },
    { path: '/template/mappings', name: "mappingTemplates", component: MappingTemplates },
    // 对账功能
    { path: '/tasks', name: "reconciliationList", component: ReconciliationList },
    { path: '/tasks/:id', name: "reconciliationForm", component: ReconciliationForm },
    // 条目审核功能
    { path: '/entry-review', name: "entryReviewForm", component: ParseReviewForm },
    // Copilot
    { path: '/assistant/:sessionId?', name: 'assistant', component: AssistantView },
    { path: '/login', name: "login", component: Login },
    { path: '/phone-binding', name: "phoneBinding", component: PhoneBinding },
    { path: '/settings', name: "settings", component: Settings },
  ]
})

// 路由守卫：检查手机号绑定状态和导览恢复
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('access');
  const username = localStorage.getItem('username');

  // 检查是否需要恢复导览（在认证检查之前，因为导览恢复可能需要跳转）
  try {
    const { shouldResumeTour, getTourProgress } = await import('./utils/userTour');
    const { getRequiredRouteForStep, ensureCorrectRoute } = await import('./utils/tourRecovery');
    
    if (shouldResumeTour()) {
      const progress = getTourProgress();
      if (progress) {
        const { currentStep } = progress;
        const requiredRoute = getRequiredRouteForStep(currentStep);
        
        // 如果步骤5，可以在任何页面，不需要跳转
        if (currentStep === 4 && requiredRoute === '') {
          // 继续正常路由流程
        }
        // 如果当前路由不匹配所需路由，需要跳转
        else if (to.path !== requiredRoute && requiredRoute !== '') {
          // 排除登录、手机绑定、OAuth回调等页面，这些页面不应该被导览跳转影响
          if (to.path !== '/login' && to.path !== '/phone-binding' && to.path !== '/auth/github/token') {
            next(requiredRoute);
            return;
          }
        }
      }
    }
  } catch (error) {
    // 如果导入失败，继续正常流程
    console.warn('导览恢复检查失败:', error);
  }

  // 如果是登录页面，检查是否已登录
  if (to.path === '/login') {
    // 如果已登录，重定向到文件管理页面
    if (token && username) {
      next('/file');
    } else {
      // 未登录用户，允许访问登录页面
      next();
    }
    return;
  }

  // 如果是手机号绑定页面或OAuth回调页面，直接放行
  if (to.path === '/phone-binding' || to.path === '/auth/github/token') {
    // 允许访问
    next();
    return;
  }

  // 如果没有token，允许匿名访问（用于访问admin用户数据）
  if (!token || !username) {
    // 匿名用户允许访问，后端会返回id=1用户的数据
    next();
    return;
  }

  // 对于需要认证的页面，检查手机号绑定状态
  try {
    const axios = (await import('./utils/request')).default;
    await axios.get('/auth/profile/me/');
    // 如果成功，说明已绑定手机号，可以继续
    next();
  } catch (error: any) {
    // 如果是403错误，跳转到手机号绑定页面
    if (error.response?.status === 403 && error.response?.data?.code === 'PHONE_NUMBER_REQUIRED') {
      // 保存当前路径
      sessionStorage.setItem('redirectAfterPhoneBinding', to.fullPath);
      next('/phone-binding');
    } else {
      // 其他错误（如401），跳转到登录页面
      next('/login');
    }
  }
})

export default router
