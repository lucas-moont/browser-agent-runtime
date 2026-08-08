import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentRuntime, AgentState } from '../runtime'
import { DEMO_GOALS } from '../runtime'
import { App, APP_TITLE } from './App'
import { formatTraceEventLabel } from './traceLabels'

function mount(ui: ReactNode): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return { container, root }
}

const mounts: Array<{ container: HTMLDivElement; root: Root }> = []

afterEach(() => {
  for (const entry of mounts.splice(0)) {
    act(() => {
      entry.root.unmount()
    })
    entry.container.remove()
  }
})

function fakeRuntime(finalState: AgentState): AgentRuntime {
  let state: AgentState = {
    status: 'idle',
    goal: null,
    context: null,
    plan: [],
    outputs: {},
    events: [],
  }

  return {
    getState: () => ({ ...state, events: [...state.events], plan: [...state.plan] }),
    run: vi.fn(async (options) => {
      state = {
        ...finalState,
        goal: options.goal,
        events: [...finalState.events],
        plan: [...finalState.plan],
      }
      return state
    }),
  } as unknown as AgentRuntime
}

describe('side panel chat shell', () => {
  it('exposes the project title', () => {
    expect(APP_TITLE).toBe('Browser Agent Runtime')
  })

  it('renders chat chrome with language select, capabilities, and demo chips', async () => {
    const { container, root } = mount(
      <App
        createRuntime={() =>
          fakeRuntime({
            status: 'idle',
            goal: null,
            context: null,
            plan: [],
            outputs: {},
            events: [],
          })
        }
        resolveTabId={async () => 1}
        loadCapabilities={async () => ({
          languageDetector: 'available',
          summarizer: 'available',
          translator: 'unavailable',
          prompt: 'downloadable',
        })}
      />,
    )
    mounts.push({ container, root })

    await act(async () => {
      await Promise.resolve()
    })

    expect(container.querySelector('h1')?.textContent).toBe(APP_TITLE)
    expect(container.querySelector('[aria-label="Preferred response language"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Built-in AI capabilities"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Conversation"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Goal instruction"]')).not.toBeNull()

    for (const goal of DEMO_GOALS) {
      expect(container.textContent).toContain(goal.label)
    }

    expect(DEMO_GOALS.some((goal) => goal.label === 'Summarize')).toBe(true)
    expect(container.textContent).toContain('Detect')
    expect(container.textContent).toContain('Off')
  })

  it('sends a Goal from a suggestion chip with preferred language context', async () => {
    const completed: AgentState = {
      status: 'completed',
      goal: { instruction: DEMO_GOALS[0].instruction },
      context: { mainText: 'hello' },
      plan: [],
      workflowId: 'analyzePage',
      outputs: {},
      events: [
        { type: 'goal_received', at: 1 },
        { type: 'context_collected', at: 2 },
        { type: 'plan_created', at: 3, workflowId: 'analyzePage' },
        { type: 'tool_started', at: 4, tool: 'detectLanguage' },
        { type: 'tool_completed', at: 5, tool: 'detectLanguage' },
        { type: 'agent_completed', at: 6 },
      ],
      result: {
        language: 'en',
        summary: 'A short summary',
        topics: ['runtime'],
        concepts: ['Plan', 'Trace'],
        preferredLanguage: 'pt',
      },
    }

    const runtime = fakeRuntime(completed)
    const { container, root } = mount(
      <App
        createRuntime={() => runtime}
        resolveTabId={async () => 7}
        loadCapabilities={async () => ({
          languageDetector: 'available',
          summarizer: 'available',
          translator: 'available',
          prompt: 'available',
        })}
      />,
    )
    mounts.push({ container, root })

    const languageSelect = container.querySelector(
      '[aria-label="Preferred response language"]',
    ) as HTMLSelectElement
    await act(async () => {
      languageSelect.value = 'pt'
      languageSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const analyzeChip = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Analyze Page',
    )
    expect(analyzeChip).toBeTruthy()

    await act(async () => {
      analyzeChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(runtime.run).toHaveBeenCalledWith({
      goal: {
        instruction: DEMO_GOALS[0].instruction,
        context: { preferredLanguage: 'pt' },
      },
      tabId: 7,
    })

    expect(container.querySelector('[data-role="user"]')?.textContent).toContain(
      DEMO_GOALS[0].instruction,
    )
    expect(container.querySelector('[data-role="assistant"]')).not.toBeNull()
    expect(container.textContent).toContain('Completed')
    expect(container.textContent).toContain('A short summary')
    expect(container.querySelector('[data-workflow="analyzePage"]')).not.toBeNull()

    const traceSummary = Array.from(container.querySelectorAll('summary')).find(
      (node) => node.textContent === 'Runtime trace',
    )
    expect(traceSummary).toBeTruthy()
    await act(async () => {
      traceSummary?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    for (const event of completed.events) {
      expect(container.textContent).toContain(formatTraceEventLabel(event))
    }
  })

  it('sends composer text on Enter and keeps Shift+Enter from submitting', async () => {
    const completed: AgentState = {
      status: 'completed',
      goal: { instruction: 'Summarize this page.' },
      context: null,
      plan: [],
      workflowId: 'summarizePage',
      outputs: {},
      events: [{ type: 'agent_completed', at: 1 }],
      result: {
        language: 'en',
        summary: 'Resumo',
        foundationLanguage: 'en',
        translatedInbound: false,
        preferredLanguage: 'en',
      },
    }
    const runtime = fakeRuntime(completed)
    const { container, root } = mount(
      <App
        createRuntime={() => runtime}
        resolveTabId={async () => 1}
        loadCapabilities={async () => ({
          languageDetector: 'available',
          summarizer: 'available',
          translator: 'available',
          prompt: 'available',
        })}
      />,
    )
    mounts.push({ container, root })

    const textarea = container.querySelector(
      '[aria-label="Goal instruction"]',
    ) as HTMLTextAreaElement
    const setNativeValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set

    await act(async () => {
      setNativeValue?.call(textarea, 'line one')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
      )
      await Promise.resolve()
    })
    expect(runtime.run).not.toHaveBeenCalled()

    await act(async () => {
      setNativeValue?.call(textarea, 'Summarize this page.')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
      await Promise.resolve()
    })

    expect(runtime.run).toHaveBeenCalledWith({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'en' },
      },
      tabId: 1,
    })
  })

  it('shows unsupported capability errors inside the assistant bubble', async () => {
    const failed: AgentState = {
      status: 'failed',
      goal: { instruction: DEMO_GOALS[1].instruction },
      context: null,
      plan: [],
      outputs: {},
      error: 'Missing required capabilities: prompt',
      events: [
        { type: 'goal_received', at: 1 },
        {
          type: 'agent_failed',
          at: 2,
          reason: 'Missing required capabilities: prompt',
        },
      ],
    }

    const { container, root } = mount(
      <App
        createRuntime={() => fakeRuntime(failed)}
        resolveTabId={async () => 1}
        loadCapabilities={async () => ({
          languageDetector: 'available',
          summarizer: 'available',
          translator: 'available',
          prompt: 'unavailable',
        })}
      />,
    )
    mounts.push({ container, root })

    const pathChip = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Learning Path',
    )
    await act(async () => {
      pathChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-kind="unsupported"]')).not.toBeNull()
    expect(container.textContent).toContain('Unsupported capability')
    expect(container.textContent).toContain('Missing required capabilities: prompt')
    expect(container.textContent).toContain('Failed')
  })
})
