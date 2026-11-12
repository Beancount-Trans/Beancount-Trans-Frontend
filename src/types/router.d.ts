import 'vue-router'
import type { Capability } from '../capabilities/types'

declare module 'vue-router' {
  interface RouteMeta {
    /** 进入该路由所需的最低能力；由 CapabilityGate 统一承接 */
    capability?: Capability
  }
}

export {}
