import type { ConversationTurn, WorkflowId } from './types'

export type DemoGoal = {
  id: string
  label: string
  instruction: string
}

/** Side-panel suggestion chips — plain message text, not workflow modes. */
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

/**
 * @deprecated Template matching removed — suggestions are ordinary messages.
 * Kept as a no-op helper so older tests/docs imports stay stable.
 */
export function matchDemoWorkflow(_instruction: string): null {
  return null
}

/** Every Goal is free-form conversation; chips only supply the instruction text. */
export function resolveWorkflowId(_instruction: string): WorkflowId {
  return 'conversational'
}
