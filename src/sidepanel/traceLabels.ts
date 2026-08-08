import type { AgentEvent } from '../runtime'

const EVENT_LABELS: Record<AgentEvent['type'], string> = {
  goal_received: 'Goal received',
  context_collected: 'PageContext collected',
  plan_created: 'Plan created',
  tool_started: 'Tool started',
  tool_completed: 'Tool completed',
  agent_completed: 'Agent completed',
  agent_failed: 'Agent failed',
}

export function formatTraceEventLabel(event: AgentEvent): string {
  const base = EVENT_LABELS[event.type]

  if (event.type === 'plan_created' && event.workflowId) {
    return `${base}: ${event.workflowId}`
  }

  if (
    (event.type === 'tool_started' || event.type === 'tool_completed') &&
    event.tool
  ) {
    return `${base}: ${event.tool}`
  }

  if (event.type === 'agent_failed' && event.reason) {
    return `${base}: ${event.reason}`
  }

  return base
}
