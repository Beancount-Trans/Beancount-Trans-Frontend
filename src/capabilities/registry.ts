import type { Capability, CapabilityReason, SessionTier } from './types'

/**
 * 能力 → 最低层级。
 * guest 只保留解析闭环；其余能力都要求登录，git 额外获得同步能力。
 */
export const CAPABILITY_MIN_TIER: Record<Capability, SessionTier> = {
  'ledger.parse': 'guest',
  'ledger.read': 'guest',
  'ledger.write': 'member',
  'file.read': 'member',
  'file.write': 'member',
  'config.read': 'member',
  'config.write': 'member',
  'template.apply': 'member',
  'task.read': 'member',
  'task.write': 'member',
  'entryReview.use': 'member',
  'assistant.use': 'member',
  'fava.use': 'member',
  'settings.manage': 'member',
  'account.bind': 'member',
  'git.manage': 'member',
  'git.sync': 'git',
}

const TIER_ORDER: Record<SessionTier, number> = {
  guest: 0,
  member: 1,
  git: 2,
}

const ALL_CAPABILITIES = Object.keys(CAPABILITY_MIN_TIER) as Capability[]

/** 当前层级可获得的能力集合 */
export function capabilitiesForTier(tier: SessionTier): Set<Capability> {
  const order = TIER_ORDER[tier]
  return new Set(
    ALL_CAPABILITIES.filter((capability) => TIER_ORDER[CAPABILITY_MIN_TIER[capability]] <= order)
  )
}

/** 门禁默认文案；组件可覆盖 */
export const CAPABILITY_REASON: Partial<Record<Capability, CapabilityReason>> = {
  'ledger.write': {
    title: '写入账本需登录',
    description: '当前解析结果已暂存在本页，登录后会自动恢复。',
    actionText: '登录 / 注册',
  },
  'file.read': {
    title: '文件管理需要登录',
    description: '登录后可上传、管理账单文件。',
    actionText: '登录 / 注册',
  },
  'config.read': {
    title: '解析配置需要登录',
    description: '登录后可维护账户、标签、映射与输出格式。',
    actionText: '登录 / 注册',
  },
  'task.read': {
    title: '此功能需要登录',
    description: '待办、对账与条目审核跟随你的账户。',
    actionText: '登录 / 注册',
  },
  'entryReview.use': {
    title: '条目审核需要登录',
    description: '登录后才能审核解析结果并写入自己的账本。',
    actionText: '登录 / 注册',
  },
  'assistant.use': {
    title: 'Copilot 需要登录',
    description: '登录后 AI 才能读取你的账本上下文。',
    actionText: '登录 / 注册',
  },
  'settings.manage': {
    title: '个人设置需要登录',
    description: '登录后可管理绑定、令牌与共享账本。',
    actionText: '登录 / 注册',
  },
  'fava.use': {
    title: 'Fava 需要登录',
    description: '登录后才会生成你的账本实例。',
    actionText: '登录 / 注册',
  },
  'git.sync': {
    title: '同步功能尚未启用',
    description: '在「设置 → 高级：本地账本」中创建或关联仓库后可同步。',
    actionText: '去设置',
    to: '/settings?tab=git',
  },
}

export function capabilityReason(capability: Capability): CapabilityReason {
  return (
    CAPABILITY_REASON[capability] ?? {
      title: '需要登录后使用',
      description: '登录后可继续该操作。',
      actionText: '登录 / 注册',
    }
  )
}
