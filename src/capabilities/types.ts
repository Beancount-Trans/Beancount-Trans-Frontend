/**
 * 能力层类型：能力是前端唯一的权限判断单位。
 * 层级只用来派生能力集合，业务代码不应直接判断 tier。
 */

export type SessionTier = 'guest' | 'member' | 'git'

export type Capability =
  | 'ledger.parse'
  | 'ledger.read'
  | 'ledger.write'
  | 'file.read'
  | 'file.write'
  | 'config.read'
  | 'config.write'
  | 'template.apply'
  | 'task.read'
  | 'task.write'
  | 'entryReview.use'
  | 'assistant.use'
  | 'fava.use'
  | 'settings.manage'
  | 'account.bind'
  | 'git.manage'
  | 'git.sync'

export interface CapabilityReason {
  /** 门禁标题 */
  title: string
  /** 说明为什么需要更高层级 */
  description: string
  /** 主按钮文案 */
  actionText: string
  /** 主按钮目标路由；缺省为登录页 */
  to?: string
}
