import type { WorkflowId } from './types'

export type DemoGoal = {
  id: WorkflowId
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

export function matchDemoWorkflow(instruction: string): WorkflowId | null {
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
    normalized.includes('summary of this page') ||
    normalized.includes('key concepts')
  ) {
    return 'analyzePage'
  }

  if (
    normalized.includes('summarize') ||
    normalized.includes('summarise') ||
    normalized.includes('portuguese') ||
    normalized.includes('português') ||
    normalized.includes('portugues')
  ) {
    return 'summarizePage'
  }

  return null
}

export function resolveWorkflowId(instruction: string): WorkflowId | null {
  const exact = DEMO_GOALS.find(
    (goal) => goal.instruction.trim().toLowerCase() === instruction.trim().toLowerCase(),
  )
  if (exact) {
    return exact.id
  }
  return matchDemoWorkflow(instruction)
}
