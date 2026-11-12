import { createRouter, createWebHistory } from 'vue-router'
import { getSessionTier } from './capabilities'

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
      // 根路径：已登录进入文件管理，游客进入解析页（游客只保留解析闭环）
      redirect: () => (getSessionTier() === 'guest' ? '/trans' : '/file')
    },
    { path: '/auth/github/token', component: AuthenticateByGithubToken },
    { path: '/trans', name: "trans", component: Trans, meta: { capability: 'ledger.parse' } },
    { path: '/format', name: "format", component: Format, meta: { capability: 'config.read' } },
    { path: '/file', name: "filemanage", component: FileManage, meta: { capability: 'file.read' } },
    { path: '/config/accounts', name: "accountManagement", component: AccountManagement, meta: { capability: 'config.read' } },
    { path: '/config/tags', name: "tagManagement", component: TagManagement, meta: { capability: 'config.read' } },
    { path: '/config/mappings', name: "mappingManagement", component: MappingManagement, meta: { capability: 'config.read' } },
    // 模板管理
    { path: '/template/accounts', name: "accountTemplates", component: AccountTemplates, meta: { capability: 'config.read' } },
    { path: '/template/mappings', name: "mappingTemplates", component: MappingTemplates, meta: { capability: 'config.read' } },
    // 对账功能
    { path: '/tasks', name: "reconciliationList", component: ReconciliationList, meta: { capability: 'task.read' } },
    { path: '/tasks/:id', name: "reconciliationForm", component: ReconciliationForm, meta: { capability: 'task.read' } },
    // 条目审核功能
    { path: '/entry-review', name: "entryReviewForm", component: ParseReviewForm, meta: { capability: 'entryReview.use' } },
    // Copilot
    { path: '/assistant/:sessionId?', name: 'assistant', component: AssistantView, meta: { capability: 'assistant.use' } },
    { path: '/login', name: "login", component: Login },
    { path: '/phone-binding', name: "phoneBinding", component: PhoneBinding },
    { path: '/settings', name: "settings", component: Settings, meta: { capability: 'settings.manage' } },
  ]
})

// 路由守卫：检查手机号绑定状态和导览恢复
router.beforeEach(async (to, from, next) => {
  const isAuthenticated = getSessionTier() !== 'guest';

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
    if (isAuthenticated) {
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

  // 游客只放行解析页；其余页面由 App.vue 的 CapabilityGate 接管
  if (!isAuthenticated) {
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
