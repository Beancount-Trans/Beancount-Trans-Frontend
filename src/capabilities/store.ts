import { computed, ref } from 'vue'
import { getGitRepository } from '../api/git'
import type { GitRepository } from '../types/git'
import { getUsername, hasAuthTokens } from '../utils/auth'
import { capabilitiesForTier, capabilityReason } from './registry'
import type { Capability, SessionTier } from './types'

const tier = ref<SessionTier>('guest')
const username = ref('')
const gitRepository = ref<GitRepository | null>(null)
const loading = ref(false)

let refreshPromise: Promise<void> | null = null
let initialized = false
let listenersBound = false

/** 路由守卫/根重定向用：同步判断，不等待 Git 仓库请求 */
export function getSessionTier(): SessionTier {
  return hasAuthTokens() ? 'member' : 'guest'
}

function resetToGuest() {
  tier.value = 'guest'
  username.value = ''
  gitRepository.value = null
}

async function refresh(force = false): Promise<void> {
  if (!hasAuthTokens()) {
    resetToGuest()
    return
  }

  username.value = getUsername() || ''
  if (tier.value === 'guest') {
    tier.value = 'member'
  }

  if (!force && gitRepository.value) {
    tier.value = 'git'
    return
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    loading.value = true
    try {
      const repository = await getGitRepository()
      gitRepository.value = repository
      tier.value = 'git'
    } catch {
      gitRepository.value = null
      tier.value = 'member'
    } finally {
      loading.value = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  window.addEventListener('bct-auth-changed', () => {
    void refresh(true)
  })
  window.addEventListener('bct-git-changed', () => {
    void refresh(true)
  })
}

export function useCapabilities() {
  bindListeners()

  if (!initialized) {
    initialized = true
    void refresh()
  }

  const capabilities = computed(() => capabilitiesForTier(tier.value))

  const can = (capability: Capability) => capabilities.value.has(capability)
  const canAny = (...items: Capability[]) => items.some((item) => can(item))

  return {
    tier,
    username,
    gitRepository,
    loading,
    capabilities,
    can,
    canAny,
    isGuest: computed(() => tier.value === 'guest'),
    isMember: computed(() => tier.value !== 'guest'),
    hasGit: computed(() => tier.value === 'git'),
    reason: capabilityReason,
    refresh,
  }
}
