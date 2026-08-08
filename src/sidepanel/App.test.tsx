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
    run: vi.fn(async () => {
      state = {
        ...finalState,
        events: [...finalState.events],
        plan: [...finalState.plan],
      }
      return state
    }),
  } as unknown as AgentRuntime
}

describe('side panel shell', () => {
  it('exposes the project title', () => {
    expect(APP_TITLE).toBe('Browser Agent Runtime')
  })

  it('renders developer-tool chrome with Trace primary and demo Goals', async () => {
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
    expect(container.querySelector('[aria-label="Agent Trace"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Built-in AI capabilities"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Agent status"]')?.textContent).toContain('Idle')

    for (const goal of DEMO_GOALS) {
      expect(container.textContent).toContain(goal.label)
    }

    expect(container.textContent).toContain('Language Detector')
    expect(container.textContent).toContain('Available')
    expect(container.textContent).toContain('Unavailable — not supported on this device')
  })

  it('runs a Goal and binds Trace + Result from AgentRuntime state', async () => {
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

    const runButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Run',
    )
    expect(runButton).toBeTruthy()

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(runtime.run).toHaveBeenCalledWith({
      goal: { instruction: DEMO_GOALS[0].instruction },
      tabId: 7,
    })

    for (const event of completed.events) {
      expect(container.textContent).toContain(formatTraceEventLabel(event))
    }

    expect(container.textContent).toContain('Completed')
    expect(container.textContent).toContain('A short summary')
    expect(container.textContent).toContain('Plan')
    expect(container.querySelector('[data-workflow="analyzePage"]')).not.toBeNull()
  })

  it('shows unsupported capability errors from failed runs', async () => {
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
    })

    const runButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Run',
    )
    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-kind="unsupported"]')).not.toBeNull()
    expect(container.textContent).toContain('Unsupported capability')
    expect(container.textContent).toContain('Missing required capabilities: prompt')
    expect(container.textContent).toContain('Failed')
  })
})
