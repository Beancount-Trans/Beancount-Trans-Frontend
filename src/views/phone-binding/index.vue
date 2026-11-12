<template>
    <div class="phone-binding-container">
        <el-card shadow="never" class="binding-card">
            <template #header>
                <div class="card-header">
                    <h2>绑定手机号</h2>
                    <el-text type="info" size="small">
                        为您的账户绑定手机号
                    </el-text>
                </div>
            </template>

            <el-form :model="form" label-width="0" class="binding-form" @submit.prevent>
                <el-form-item>
                    <el-input v-model="form.phone" placeholder="手机号" size="large" clearable>
                        <template #prefix>
                            <el-icon>
                                <Phone />
                            </el-icon>
                        </template>
                    </el-input>
                </el-form-item>

                <el-form-item>
                    <div class="code-input-group">
                        <el-input v-model="form.code" placeholder="验证码" size="large" maxlength="6" clearable>
                            <template #prefix>
                                <el-icon>
                                    <Message />
                                </el-icon>
                            </template>
                        </el-input>
                        <el-button :disabled="sendDisabled" :loading="sending" @click="sendCode">
                            {{ sending ? `${countdown}s` : '发送验证码' }}
                        </el-button>
                    </div>
                </el-form-item>

                <el-form-item>
                    <el-button type="primary" size="large" class="submit-button" :loading="submitting"
                        @click="handleSubmit">
                        绑定手机号
                    </el-button>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Phone, Message } from '@element-plus/icons-vue'
import axios from '../../utils/request'
import { consumeLoginRedirect } from '../../utils/auth'

const router = useRouter()

const sending = ref(false)
const submitting = ref(false)
const countdown = ref(60)
let countdownTimer: number | null = null

const form = reactive({
    phone: '',
    code: '',
})

const sendDisabled = computed(() => {
    const trimmed = form.phone.trim()
    return sending.value || trimmed.length < 5
})

const startCountdown = () => {
    sending.value = true
    countdown.value = 60
    if (countdownTimer) {
        clearInterval(countdownTimer)
    }
    countdownTimer = window.setInterval(() => {
        countdown.value -= 1
        if (countdown.value <= 0) {
            sending.value = false
            if (countdownTimer) {
                clearInterval(countdownTimer)
                countdownTimer = null
            }
        }
    }, 1000)
}

const normalizePhone = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return trimmed
    if (trimmed.startsWith('+')) return trimmed
    if (trimmed.startsWith('86')) return `+${trimmed}`
    return `+86${trimmed}`
}

const sendCode = async () => {
    if (sendDisabled.value) return
    try {
        await axios.post('/auth/phone/send-code/', {
            phone_number: normalizePhone(form.phone),
        })
        ElMessage.success('验证码已发送')
        startCountdown()
    } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '验证码发送失败')
    }
}

const handleSubmit = async () => {
    if (!form.phone.trim() || !form.code.trim()) {
        ElMessage.warning('请先填写手机号和验证码')
        return
    }

    submitting.value = true
    try {
        // 执行绑定操作
        const resp = await axios.post('/auth/bindings/bind-phone/', {
            phone_number: normalizePhone(form.phone),
            code: form.code.trim(),
        })
        if (resp.status === 200) {
            ElMessage.success('手机号绑定成功')

            // 检查是否有待返回的路径（登录前记录的目标页优先）
            const redirectPath = consumeLoginRedirect()
                || sessionStorage.getItem('redirectAfterPhoneBinding')
            if (redirectPath) {
                sessionStorage.removeItem('redirectAfterPhoneBinding')
                router.push(redirectPath)
            } else {
                router.push('/file')
            }
        }
    } catch (error: any) {
        if (error.response?.data?.error?.includes('已被注册')) {
            ElMessage.warning('该手机号已被注册，请使用其他手机号')
        } else {
            ElMessage.error(error.response?.data?.error || '绑定失败，请重试')
        }
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.phone-binding-container {
    min-height: calc(100vh - 80px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

.binding-card {
    width: 100%;
    max-width: 480px;
    border-radius: 12px;
}

.card-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.code-input-group {
    display: flex;
    gap: 8px;
}

.code-input-group :deep(.el-input) {
    flex: 1;
}

.submit-button {
    width: 100%;
}

.form-hint {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
}
</style>