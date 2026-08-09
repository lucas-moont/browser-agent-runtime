import type { AgentEvent } from '../runtime'

const TOOL_STARTED: Record<string, string> = {
  searchWeb: 'Searching the web…',
  extractPage: 'Reading the page…',
  detectLanguage: 'Detecting language…',
  summarize: 'Summarizing…',
  prompt: 'Writing a reply…',
  translate: 'Translating…',
  openTab: 'Opening a tab…',
  navigateTab: 'Navigating…',
  closeTab: 'Closing a tab…',
}

const TOOL_BETWEEN: Record<string, string> = {
  searchWeb: 'Reviewing search results…',
  extractPage: 'Processing the page…',
  detectLanguage: 'Language detected…',
  summarize: 'Summary ready…',
  prompt: 'Finishing up…',
  translate: 'Translation ready…',
}

export function runningStatusFromEvents(events: readonly AgentEvent[]): string {
  const last = events.at(-1)
  if (!last) {
    return 'Working…'
  }

  switch (last.type) {
    case 'goal_received':
      return 'Starting…'
    case 'context_collected':
      return 'Reading the page…'
    case 'plan_created':
      return 'Planning…'
    case 'tool_started':
      return TOOL_STARTED[last.tool ?? ''] ?? 'Working…'
    case 'tool_completed':
      return TOOL_BETWEEN[last.tool ?? ''] ?? 'Continuing…'
    case 'agent_completed':
      return 'Done'
    case 'agent_failed':
      return 'Something went wrong'
    default:
      return 'Working…'
  }
}
