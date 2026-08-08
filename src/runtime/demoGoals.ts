import type { ConversationTurn, WorkflowId } from './types'

export type DemoGoal = {
  id: Exclude<WorkflowId, 'conversational'>
  label: string
  instruction: string
}

export const DEMO_GOALS: readonly DemoGoal[] = [
  {
    id: 'analyzePage',
    label: 'Analyze Page',
    instruction: 'Analyze this page.',
  },
  {
    id: 'learningPath',
    label: 'Learning Path',
    instruction: 'Turn this page into a learning path.',
  },
  {
    id: 'summarizePage',
    label: 'Summarize',
    instruction: 'Summarize this page.',
  },
] as const

export function formatConversationHistory(history: ConversationTurn[] | undefined): string {
  if (!history || history.length === 0) {
    return '(none)'
  }
  return history
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
    .join('\n')
}

export function matchDemoWorkflow(instruction: string): Exclude<WorkflowId, 'conversational'> | null {
  const normalized = instruction.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (
    normalized.includes('learning path') ||
    normalized.includes('study path') ||
    normalized.includes('prerequisites')
  ) {
    return 'learningPath'
  }

  if (
    normalized.includes('analyze') ||
    normalized.includes('analyse') ||
    normalized.includes('key concepts')
  ) {
    return 'analyzePage'
  }

  if (
    normalized === 'summarize this page.' ||
    normalized === 'summarize this page' ||
    (normalized.includes('summarize') &&
      !normalized.includes('learning') &&
      normalized.includes('page') &&
      normalized.split(/\s+/).length <= 6)
  ) {
    return 'summarizePage'
  }

  return null
}

/** Maps known demo phrasing to templates; everything else is free-form conversation. */
export function resolveWorkflowId(instruction: string): WorkflowId {
  const exact = DEMO_GOALS.find(
    (goal) => goal.instruction.trim().toLowerCase() === instruction.trim().toLowerCase(),
  )
  if (exact) {
    return exact.id
  }
  return matchDemoWorkflow(instruction) ?? 'conversational'
}
