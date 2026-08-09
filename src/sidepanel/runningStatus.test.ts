import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '../runtime'
import { runningStatusFromEvents } from './runningStatus'

describe('runningStatusFromEvents', () => {
  it('defaults to Working when there are no events yet', () => {
    expect(runningStatusFromEvents([])).toBe('Working…')
  })

  it('maps milestones and tools to short Claude-like lines', () => {
    const events: AgentEvent[] = [
      { type: 'goal_received', at: 1 },
      { type: 'context_collected', at: 2 },
      { type: 'plan_created', at: 3, workflowId: 'conversational' },
      { type: 'tool_started', at: 4, tool: 'searchWeb' },
      { type: 'tool_completed', at: 5, tool: 'searchWeb' },
      { type: 'tool_started', at: 6, tool: 'prompt' },
    ]

    expect(runningStatusFromEvents(events.slice(0, 1))).toBe('Starting…')
    expect(runningStatusFromEvents(events.slice(0, 2))).toBe('Reading the page…')
    expect(runningStatusFromEvents(events.slice(0, 3))).toBe('Planning…')
    expect(runningStatusFromEvents(events.slice(0, 4))).toBe('Searching the web…')
    expect(runningStatusFromEvents(events.slice(0, 5))).toBe('Reviewing search results…')
    expect(runningStatusFromEvents(events)).toBe('Writing a reply…')
  })
})
