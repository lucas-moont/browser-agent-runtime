import { describe, expect, it } from 'vitest'
import { formatTraceEventLabel } from './traceLabels'

describe('formatTraceEventLabel', () => {
  it('maps high-level Event types without chain-of-thought', () => {
    expect(formatTraceEventLabel({ type: 'goal_received', at: 1 })).toBe('Goal received')
    expect(formatTraceEventLabel({ type: 'context_collected', at: 1 })).toBe('Page read')
    expect(formatTraceEventLabel({ type: 'agent_completed', at: 1 })).toBe('Done')
  })

  it('includes workflow and tool names when present', () => {
    expect(
      formatTraceEventLabel({
        type: 'plan_created',
        at: 1,
        workflowId: 'analyzePage',
      }),
    ).toBe('Plan: analyzePage')

    expect(
      formatTraceEventLabel({
        type: 'tool_started',
        at: 1,
        tool: 'summarize',
      }),
    ).toBe('Started: summarize')

    expect(
      formatTraceEventLabel({
        type: 'tool_completed',
        at: 1,
        tool: 'detectLanguage',
      }),
    ).toBe('Finished: detectLanguage')
  })

  it('surfaces failure reason on agent_failed', () => {
    expect(
      formatTraceEventLabel({
        type: 'agent_failed',
        at: 1,
        reason: 'Missing required capabilities: summarizer',
      }),
    ).toBe('Failed: Missing required capabilities: summarizer')
  })
})
