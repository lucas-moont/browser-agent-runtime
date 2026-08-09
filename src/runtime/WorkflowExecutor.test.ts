import { describe, expect, it, vi } from 'vitest'
import { createWorkflowExecutor } from './WorkflowExecutor'
import type { Plan } from './types'

describe('WorkflowExecutor seam', () => {
  it('runs a linear plan in order and records outputs', async () => {
    const calls: string[] = []
    const tools = {
      execute: vi.fn(async (name: string, input: unknown) => {
        calls.push(name)
        if (name === 'detectLanguage') {
          return { language: 'en', confidence: 1, detections: [] }
        }
        if (name === 'summarize') {
          return {
            summary: `summary:${String((input as { text: string }).text)}`,
            sourceLanguage: 'en',
            foundationLanguage: 'en',
            translatedInbound: false,
          }
        }
        throw new Error(`unexpected tool ${name}`)
      }),
    }

    const plan: Plan = {
      workflowId: 'analyzePage',
      steps: [
        { id: 'detect', tool: 'detectLanguage', input: { text: { $from: 'context.mainText' } } },
        {
          id: 'summarize',
          tool: 'summarize',
          input: {
            text: { $from: 'context.mainText' },
            sourceLanguage: { $from: 'detect.language' },
          },
          dependsOn: ['detect'],
        },
      ],
    }

    const executor = createWorkflowExecutor()
    const result = await executor.execute({
      plan,
      tools,
      context: { mainText: 'Hello page' },
    })

    expect(result.ok).toBe(true)
    expect(calls).toEqual(['detectLanguage', 'summarize'])
    if (!result.ok) {
      return
    }
    expect(result.outputs.detect).toMatchObject({ language: 'en' })
    expect(result.outputs.summarize).toMatchObject({ summary: 'summary:Hello page' })
    expect(tools.execute.mock.calls[1]?.[1]).toMatchObject({
      text: 'Hello page',
      sourceLanguage: 'en',
    })
  })

  it('does not start a dependent step until parents complete', async () => {
    const active: string[] = []
    const tools = {
      async execute(name: string) {
        active.push(`start:${name}`)
        if (name === 'slow') {
          await Promise.resolve()
          active.push('done:slow')
          return { value: 1 }
        }
        expect(active).toContain('done:slow')
        active.push(`done:${name}`)
        return { value: 2 }
      },
    }

    const plan: Plan = {
      workflowId: 'analyzePage',
      steps: [
        { id: 'child', tool: 'fast', input: {}, dependsOn: ['parent'] },
        { id: 'parent', tool: 'slow', input: {} },
      ],
    }

    const result = await createWorkflowExecutor().execute({ plan, tools })
    expect(result.ok).toBe(true)
    expect(active).toEqual(['start:slow', 'done:slow', 'start:fast', 'done:fast'])
  })

  it('stops on tool failure and skips dependents', async () => {
    const tools = {
      execute: vi.fn(async (name: string) => {
        if (name === 'detectLanguage') {
          throw new Error('detect failed')
        }
        return { ok: true }
      }),
    }

    const plan: Plan = {
      workflowId: 'analyzePage',
      steps: [
        { id: 'detect', tool: 'detectLanguage', input: { text: 'x' } },
        {
          id: 'summarize',
          tool: 'summarize',
          input: { text: 'x' },
          dependsOn: ['detect'],
        },
      ],
    }

    const result = await createWorkflowExecutor().execute({ plan, tools })
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.reason).toBe('detect failed')
    expect(result.failedStepId).toBe('detect')
    expect(result.outputs).toEqual({})
    expect(tools.execute).toHaveBeenCalledTimes(1)
    expect(result.events.map((event) => event.type)).toEqual([
      'tool_started',
      'tool_failed',
    ])
  })

  it('fails for unknown tool without invoking later steps', async () => {
    const tools = {
      execute: vi.fn(async (name: string) => {
        if (name === 'detectLanguage') {
          return { language: 'en' }
        }
        throw new Error(`Unknown tool: ${name}`)
      }),
    }

    const plan: Plan = {
      workflowId: 'analyzePage',
      steps: [
        { id: 'detect', tool: 'detectLanguage', input: { text: 'x' } },
        {
          id: 'missing',
          tool: 'doesNotExist',
          input: {},
          dependsOn: ['detect'],
        },
        {
          id: 'after',
          tool: 'summarize',
          input: {},
          dependsOn: ['missing'],
        },
      ],
    }

    const result = await createWorkflowExecutor().execute({ plan, tools })
    expect(result.ok).toBe(false)
    expect(tools.execute.mock.calls.map((call) => call[0])).toEqual([
      'detectLanguage',
      'doesNotExist',
    ])
  })

  it('emits tool_started and tool_completed for each successful step', async () => {
    const tools = {
      async execute(name: string) {
        return { name }
      },
    }
    const plan: Plan = {
      workflowId: 'analyzePage',
      steps: [
        { id: 'a', tool: 'one', input: {} },
        { id: 'b', tool: 'two', input: {}, dependsOn: ['a'] },
      ],
    }

    const result = await createWorkflowExecutor().execute({ plan, tools })
    expect(result.ok).toBe(true)
    expect(result.events.map((event) => `${event.type}:${event.tool}`)).toEqual([
      'tool_started:one',
      'tool_completed:one',
      'tool_started:two',
      'tool_completed:two',
    ])
  })

  it('fails a step when the tool exceeds its timeout', async () => {
    vi.useFakeTimers()
    const tools = {
      execute: vi.fn(() => new Promise(() => undefined)),
    }
    const plan: Plan = {
      workflowId: 'conversational',
      steps: [{ id: 'reply', tool: 'prompt', input: { text: 'hi' } }],
    }

    const pending = createWorkflowExecutor().execute({ plan, tools })
    await vi.advanceTimersByTimeAsync(90_000)
    const result = await pending
    vi.useRealTimers()

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.reason).toContain('timed out')
    expect(result.events.some((event) => event.type === 'tool_failed')).toBe(true)
  })
})
