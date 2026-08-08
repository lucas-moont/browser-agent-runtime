import { describe, expect, it } from 'vitest'
import { formatTraceEventLabel } from './traceLabels'

describe('formatTraceEventLabel', () => {
  it('maps high-level Event types without chain-of-thought', () => {
    expect(formatTraceEventLabel({ type: 'goal_received', at: 1 })).toBe('Goal received')
    expect(formatTraceEventLabel({ type: 'context_collected', at: 1 })).toBe(
      'PageContext collected',
    )
    expect(formatTraceEventLabel({ type: 'agent_completed', at: 1 })).toBe('Agent completed')
  })

  it('includes workflow and tool names when present', () => {
    expect(
      formatTraceEventLabel({
        type: 'plan_created',
        at: 1,
        workflowId: 'analyzePage',
      }),
    ).toBe('Plan created: analyzePage')

    expect(
      formatTraceEventLabel({
        type: 'tool_started',
        at: 1,
        tool: 'summarize',
      }),
    ).toBe('Tool started: summarize')

    expect(
      formatTraceEventLabel({
        type: 'tool_completed',
        at: 1,
        tool: 'detectLanguage',
      }),
    ).toBe('Tool completed: detectLanguage')
  })

  it('surfaces failure reason on agent_failed', () => {
    expect(
      formatTraceEventLabel({
        type: 'agent_failed',
        at: 1,
        reason: 'Missing required capabilities: summarizer',
      }),
    ).toBe('Agent failed: Missing required capabilities: summarizer')
  })
})
