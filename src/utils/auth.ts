// 设置JWT令牌
export const setAuthTokens = (accessToken: string, refreshToken: string, username?: string) => {
  localStorage.setItem('access', accessToken)
  localStorage.setItem('refresh', refreshToken)
  if (username) {
    localStorage.setItem('username', username)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bct-auth-changed'))
  }
  console.log('JWT令牌已设置')
}

// 清除JWT令牌
export const clearAuthTokens = () => {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('username')
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bct-auth-changed'))
  }
  console.log('JWT令牌已清除')
}

// 检查令牌是否存在
export const hasAuthTokens = () => {
  return !!(localStorage.getItem('access') && localStorage.getItem('username'))
}

// 获取访问令牌
export const getAccessToken = () => {
  return localStorage.getItem('access')
}

// 获取刷新令牌
export const getRefreshToken = () => {
  return localStorage.getItem('refresh')
}

// 获取用户名
export const getUsername = () => {
  return localStorage.getItem('username')
}

// 登录后回跳路径（会话级：关闭标签即失效）
const LOGIN_REDIRECT_KEY = 'redirectAfterLogin'

// 记录登录成功后要跳转的页面（如解析页写入账本需要先登录）
export const setLoginRedirect = (path: string) => {
  sessionStorage.setItem(LOGIN_REDIRECT_KEY, path)
}

// 取出并清除回跳路径；无记录时返回 null
export const consumeLoginRedirect = (): string | null => {
  const path = sessionStorage.getItem(LOGIN_REDIRECT_KEY)
  if (path) sessionStorage.removeItem(LOGIN_REDIRECT_KEY)
  return path
}

// 检查令牌是否即将过期（提前5分钟刷新）
export const isTokenExpiringSoon = () => {
  const token = getAccessToken()
  if (!token) return true

  try {
    // 解析JWT令牌
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    const expirationTime = payload.exp
    const timeUntilExpiry = expirationTime - currentTime

    // 如果令牌在5分钟内过期，返回true
    return timeUntilExpiry < 300 // 5分钟 = 300秒
  } catch (error) {
    console.error('Error parsing token:', error)
    return true
  }
}
