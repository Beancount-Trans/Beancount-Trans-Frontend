<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>账户登录</h2>
          <el-text type="info" size="small">
            请登录继续管理您的财务报告
          </el-text>
        </div>
      </template>

      <!-- 登录表单 -->
      <div class="login-form">
        <el-tabs v-model="loginMethod" class="login-tabs">
          <el-tab-pane v-if="smsEnabled" label="手机号登录" name="phone">
            <el-form ref="phoneLoginFormRef" :model="phoneLoginForm" :rules="phoneLoginRules" label-width="0">
              <el-form-item prop="phone_number">
                <el-input v-model="phoneLoginForm.phone_number" placeholder="手机号" size="large" clearable>
                  <template #prefix>
                    <el-icon>
                      <Phone />
                    </el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item prop="code">
                <div class="code-input-group">
                  <el-input v-model="phoneLoginForm.code" placeholder="验证码" size="large" maxlength="6" clearable
                    @keyup.enter="handlePhoneLoginByCode">
                    <template #prefix>
                      <el-icon>
                        <Message />
                      </el-icon>
                    </template>
                  </el-input>
                  <el-button :disabled="!canSendCode || codeSending" :loading="codeSending" @click="sendLoginCode">
                    {{ codeSending ? `${countdown}s` : '发送验证码' }}
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="large" class="login-button" :loading="loginLoading"
                  @click="handlePhoneLoginByCode">
                  验证码登录
                </el-button>
                <div class="login-hint">
                  <el-text type="info" size="small">
                    温馨提示：未注册手机号验证后将自动完成注册
                  </el-text>
                </div>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="账密登录" name="username">
            <el-form ref="usernameLoginFormRef" :model="usernameLoginForm" :rules="usernameLoginRules" label-width="0"
              @submit.prevent="handleUsernameLogin">
              <el-form-item prop="username">
                <el-input v-model="usernameLoginForm.username" placeholder="用户名 / 手机号 / 邮箱" size="large" clearable>
                  <template #prefix>
                    <el-icon>
                      <User />
                    </el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item prop="password">
                <el-input v-model="usernameLoginForm.password" type="password" placeholder="密码" size="large"
                  show-password clearable @keyup.enter="handleUsernameLogin">
                  <template #prefix>
                    <el-icon>
                      <Lock />
                    </el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item>
                <el-input v-model="usernameLoginForm.totp_code" placeholder="TOTP验证码（未设置可忽略）" size="large" maxlength="6"
                  clearable @keyup.enter="handleUsernameLogin">
                  <template #prefix>
                    <el-icon>
                      <Message />
                    </el-icon>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="large" class="login-button" :loading="loginLoading"
                  @click="handleUsernameLogin">
                  登录
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>

        <!-- OAuth登录 -->
        <el-divider>第三方登录</el-divider>
        <div class="oauth-buttons">
          <el-button type="default" size="large" class="oauth-button" @click="loginWithGitHub">
            <el-icon><svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg></el-icon>
            GitHub 登录
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock, Phone, Message } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import router from '~/routers'
import { consumeLoginRedirect } from '../../utils/auth'
import { emitTaskBannerRefresh } from '../../utils/accountEvents'
import { initTourState } from '../../utils/userTour'

/** 登录成功后的跳转：优先回到登录前记录的目标页（如解析页要写入账本） */
const goAfterLogin = () => {
  router.push(consumeLoginRedirect() || '/file')
}

// 登录相关（默认手机号页；无短信时由 public-config 切到账密）
const smsEnabled = ref(true)
/** 与后端 PHONE_BINDING_REQUIRED 对齐；未拉到 public-config 前默认为 true */
const phoneBindingRequired = ref(true)
const loginMethod = ref('phone')
const loginLoading = ref(false)

onMounted(async () => {
  try {
    const { data } = await axios.get(`/auth/public-config/`)
    if (data && typeof data.sms_enabled === 'boolean') {
      smsEnabled.value = data.sms_enabled
    }
    if (data && typeof data.phone_binding_required === 'boolean') {
      phoneBindingRequired.value = data.phone_binding_required
    }
    if (!smsEnabled.value && loginMethod.value === 'phone') {
      loginMethod.value = 'username'
    }
  } catch {
    // 保持默认，兼容旧后端
  }
})

// 验证码相关
const codeSending = ref(false)
const countdown = ref(60)
let countdownTimer: number | null = null

// 表单引用
const usernameLoginFormRef = ref<FormInstance>()
const phoneLoginFormRef = ref<FormInstance>()

// 用户名登录表单
const usernameLoginForm = reactive({
  username: '',
  password: '',
  totp_code: ''
})

// 手机号登录表单
const phoneLoginForm = reactive({
  phone_number: '',
  code: ''
})

// 验证规则
const usernameLoginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名或手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const phoneLoginRules: FormRules = {
  phone_number: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为6位数字', trigger: 'blur' }
  ]
}

// 手机号格式化
const normalizePhone = (phone: string): string => {
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('86')) return '+' + trimmed
  return '+86' + trimmed
}

// 是否可以发送验证码（登录）
const canSendCode = computed(() => {
  return phoneLoginForm.phone_number.length === 11
})

// 开始倒计时
const startCountdown = () => {
  codeSending.value = true
  countdown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = window.setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      codeSending.value = false
      if (countdownTimer) clearInterval(countdownTimer)
    }
  }, 1000)
}

// 发送登录验证码
const sendLoginCode = async () => {
  if (!phoneLoginFormRef.value) return
  await phoneLoginFormRef.value.validateField('phone_number')

  try {
    const resp = await axios.post('/auth/phone/send-code/', {
      phone_number: normalizePhone(phoneLoginForm.phone_number)
    })
    if (resp.status === 200) {
      ElMessage.success('验证码已发送')
      startCountdown()
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '发送失败')
  }
}

// 判断输入是否为手机号
const isPhoneNumber = (input: string): boolean => {
  return /^1[3-9]\d{9}$/.test(input.trim())
}

// 判断输入是否为邮箱
const isEmail = (input: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim())
}

// 账密登录（支持用户名/手机号/邮箱+密码+TOTP）
const handleUsernameLogin = async () => {
  if (!usernameLoginFormRef.value) return
  await usernameLoginFormRef.value.validate()

  loginLoading.value = true

  // 判断输入的是手机号、邮箱还是用户名
  const isPhone = isPhoneNumber(usernameLoginForm.username)
  const isEmailAddr = isEmail(usernameLoginForm.username)

  try {
    let res: any

    if (isPhone) {
      // 手机号+密码登录（支持TOTP）
      const payload: any = {
        phone_number: normalizePhone(usernameLoginForm.username),
        password: usernameLoginForm.password
      }
      if (usernameLoginForm.totp_code) {
        payload.totp_code = usernameLoginForm.totp_code
      }

      res = await axios.post('/auth/phone/login-by-password/', payload)

      const { setAuthTokens } = await import('../../utils/auth')
      setAuthTokens(
        res.data.access,
        res.data.refresh,
        res.data.user.username
      )

      ElMessage.success('登录成功')

      // 检查是否是新用户，如果是则延迟触发待办横幅刷新
      if (res.data.is_new_user) {
        setTimeout(() => {
          emitTaskBannerRefresh()
        }, 2000) // 延迟2秒，确保后端完成账户和待办的创建
      }

      goAfterLogin()
    } else {
      // 用户名/邮箱+密码登录（支持TOTP）
      const payload: any = {
        username: usernameLoginForm.username,
        password: usernameLoginForm.password
      }
      if (usernameLoginForm.totp_code) {
        payload.totp_code = usernameLoginForm.totp_code
      }

      res = await axios.post('/auth/username/login-by-password/', payload)

      const { setAuthTokens } = await import('../../utils/auth')
      setAuthTokens(
        res.data.access,
        res.data.refresh,
        res.data.user.username
      )

      ElMessage.success('登录成功')

      // 检查是否是新用户，如果是则延迟触发待办横幅刷新
      if (res.data.is_new_user) {
        setTimeout(() => {
          emitTaskBannerRefresh()
        }, 2000) // 延迟2秒，确保后端完成账户和待办的创建
      }

      // 检查手机号绑定状态（须与后端 PHONE_BINDING_REQUIRED / public-config 一致）
      const mustBindPhone =
        phoneBindingRequired.value && !res.data.user.phone_number
      if (mustBindPhone) {
        ElMessage.warning('请先绑定手机号')
        router.push('/phone-binding')
      } else {
        goAfterLogin()
      }
    }
  } catch (error: any) {
    if (error.response?.status === 403 && error.response?.data?.code === 'PHONE_NUMBER_REQUIRED') {
      ElMessage.warning('请先绑定手机号')
      router.push('/phone-binding')
    } else if (error.response?.data?.requires_totp) {
      ElMessage.warning(error.response?.data?.error || '该账户已启用TOTP二次验证，请输入TOTP验证码')
    } else {
      ElMessage.error(error.response?.data?.error || error.response?.data?.message || '登录失败')
    }
  } finally {
    loginLoading.value = false
  }
}

// 手机号验证码登录
const handlePhoneLoginByCode = async () => {
  if (!phoneLoginFormRef.value) return
  await phoneLoginFormRef.value.validateField('phone_number')
  await phoneLoginFormRef.value.validateField('code')

  loginLoading.value = true
  try {
    const res = await axios.post('/auth/phone/login-by-code/', {
      phone_number: normalizePhone(phoneLoginForm.phone_number),
      code: phoneLoginForm.code
    })

    const { setAuthTokens } = await import('../../utils/auth')
    setAuthTokens(
      res.data.access,
      res.data.refresh,
      res.data.user.username
    )

    ElMessage.success('登录成功')

    // 检查是否是新用户，如果是则设置引导标记并触发待办横幅刷新
    if (res.data.is_new_user) {
      localStorage.setItem('start_tour', 'true')
      initTourState() // 初始化导览状态
      // 延迟触发待办横幅刷新，确保后端完成账户和待办的创建
      setTimeout(() => {
        emitTaskBannerRefresh()
      }, 2000) // 延迟2秒
    }

    // 检查是否需要2FA
    // if (res.data.requires_2fa) {
    //   ElMessage.info('请完成双因素认证')
    //   // TODO: 跳转到2FA验证页面
    // }

    goAfterLogin()
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败')
  } finally {
    loginLoading.value = false
  }
}

// GitHub OAuth登录
const loginWithGitHub = () => {
  const providerId = 'github'
  const callbackURL = window.location.origin + '/auth/github/token'

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/api/_allauth/browser/v1/auth/provider/redirect'
  form.style.display = 'none'

  const providerInput = document.createElement('input')
  providerInput.type = 'hidden'
  providerInput.name = 'provider'
  providerInput.value = providerId
  form.appendChild(providerInput)

  const callbackInput = document.createElement('input')
  callbackInput.type = 'hidden'
  callbackInput.name = 'callback_url'
  callbackInput.value = callbackURL
  form.appendChild(callbackInput)

  const processInput = document.createElement('input')
  processInput.type = 'hidden'
  processInput.name = 'process'
  processInput.value = 'login'
  form.appendChild(processInput)

  document.body.appendChild(form)
  form.submit()
}

</script>

<style scoped>
.login-container {
  min-height: calc(100vh - 80px);
  /* 假定 header 48px，如需具体请调整 */
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
  overflow: auto;
  box-sizing: border-box;
  background: radial-gradient(circle at top, rgba(64, 158, 255, 0.18), transparent 55%),
    radial-gradient(circle at bottom, rgba(103, 194, 58, 0.12), transparent 60%);
}

:deep(html.dark) .login-container {
  background: radial-gradient(circle at top, rgba(64, 158, 255, 0.12), transparent 55%),
    radial-gradient(circle at bottom, rgba(103, 194, 58, 0.08), transparent 60%);
}

.login-card {
  width: 100%;
  max-width: 480px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(16px);
}

:deep(html.dark) .login-card {
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
}

.login-tabs {
  margin-bottom: 20px;
}

.code-input-group {
  display: flex;
  gap: 8px;
}

.code-input-group :deep(.el-input) {
  flex: 1;
}

.login-button {
  width: 100%;
  margin-top: 10px;
}

.login-hint {
  margin-top: 12px;
  text-align: center;
}

.oauth-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.oauth-button {
  width: 100%;
}

:deep(.el-tabs__item) {
  font-size: 16px;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  background-color: var(--el-color-white, var(--el-bg-color));
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
}

:deep(.el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
</style>
