import type { AgentEvent } from '../runtime'

const EVENT_LABELS: Record<AgentEvent['type'], string> = {
  goal_received: 'Goal received',
  context_collected: 'Page read',
  plan_created: 'Plan',
  tool_started: 'Started',
  tool_completed: 'Finished',
  agent_completed: 'Done',
  agent_failed: 'Failed',
  agent_cancelled: 'Cancelled',
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

  if ((event.type === 'agent_failed' || event.type === 'agent_cancelled') && event.reason) {
    return `${base}: ${event.reason}`
  }

  return base
}
