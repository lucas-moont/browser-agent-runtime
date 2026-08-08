import type { Goal } from './types'

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

export type Policy = {
  authorizeGoal(goal: Goal): PolicyDecision
  authorizeTool?(toolName: string, goal: Goal): PolicyDecision
}

export type PolicyOptions = {
  denyGoal?: (goal: Goal) => string | null | undefined
  denyTool?: (toolName: string, goal: Goal) => string | null | undefined
}

export function createAllowByDefaultPolicy(options: PolicyOptions = {}): Policy {
  return {
    authorizeGoal(goal) {
      const reason = options.denyGoal?.(goal)
      if (reason) {
        return { allowed: false, reason }
      }
      return { allowed: true }
    },
    authorizeTool(toolName, goal) {
      const reason = options.denyTool?.(toolName, goal)
      if (reason) {
        return { allowed: false, reason }
      }
      return { allowed: true }
    },
  }
}
