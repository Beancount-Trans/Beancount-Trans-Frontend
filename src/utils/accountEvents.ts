const ACCOUNT_TREE_UPDATED_EVENT = 'account-tree-updated'
const TASK_BANNER_REFRESH_EVENT = 'task-banner-refresh'
const GIT_REPOSITORY_CHANGED_EVENT = 'bct-git-changed'

export const emitAccountTreeUpdated = () => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_TREE_UPDATED_EVENT))
}

export const subscribeAccountTreeUpdated = (handler: EventListener) => {
    window.addEventListener(ACCOUNT_TREE_UPDATED_EVENT, handler)
    return () => window.removeEventListener(ACCOUNT_TREE_UPDATED_EVENT, handler)
}

export const emitTaskBannerRefresh = () => {
    window.dispatchEvent(new CustomEvent(TASK_BANNER_REFRESH_EVENT))
}

export const subscribeTaskBannerRefresh = (handler: EventListener) => {
    window.addEventListener(TASK_BANNER_REFRESH_EVENT, handler)
    return () => window.removeEventListener(TASK_BANNER_REFRESH_EVENT, handler)
}

/** Git 仓库创建/删除/取消同步后通知能力层刷新 */
export const emitGitRepositoryChanged = () => {
    window.dispatchEvent(new CustomEvent(GIT_REPOSITORY_CHANGED_EVENT))
}

export const subscribeGitRepositoryChanged = (handler: EventListener) => {
    window.addEventListener(GIT_REPOSITORY_CHANGED_EVENT, handler)
    return () => window.removeEventListener(GIT_REPOSITORY_CHANGED_EVENT, handler)
}

export { ACCOUNT_TREE_UPDATED_EVENT, TASK_BANNER_REFRESH_EVENT, GIT_REPOSITORY_CHANGED_EVENT }
