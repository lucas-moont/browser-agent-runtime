import { useEffect, useRef, useState } from 'react'
import { resolveActiveTabId } from '../adapters/chrome-messaging'
import type { CapabilitySnapshot } from '../capabilities/CapabilityRegistry'
import {
  DEMO_GOALS,
  type AgentRuntime,
  type AgentState,
  type DemoGoal,
} from '../runtime'
import { AgentStatusView } from './AgentStatus'
import { AgentTrace } from './AgentTrace'
import { CapabilityStrip } from './CapabilityStrip'
import {
  createSidePanelCapabilityRegistry,
  createSidePanelRuntime,
} from './createSidePanelRuntime'
import { GoalControls } from './GoalControls'
import { ResultView } from './ResultView'

export const APP_TITLE = 'Browser Agent Runtime'

export const DEFAULT_CAPABILITY_SNAPSHOT: CapabilitySnapshot = {
  languageDetector: 'unavailable',
  summarizer: 'unavailable',
  translator: 'unavailable',
  prompt: 'unavailable',
}

const DEFAULT_TRANSLATOR_PAIR = {
  sourceLanguage: 'en',
  targetLanguage: 'pt',
} as const

const IDLE_STATE: AgentState = {
  status: 'idle',
  goal: null,
  context: null,
  plan: [],
  outputs: {},
  events: [],
}

export type AppProps = {
  createRuntime?: () => AgentRuntime
  resolveTabId?: () => Promise<number | undefined>
  loadCapabilities?: () => Promise<CapabilitySnapshot>
}

export function App({
  createRuntime = createSidePanelRuntime,
  resolveTabId = async () => {
    try {
      return await resolveActiveTabId()
    } catch {
      return undefined
    }
  },
  loadCapabilities = async () => {
    const registry = createSidePanelCapabilityRegistry()
    return registry.snapshot({ translator: DEFAULT_TRANSLATOR_PAIR })
  },
}: AppProps = {}) {
  const [snapshot, setSnapshot] = useState<CapabilitySnapshot>(DEFAULT_CAPABILITY_SNAPSHOT)
  const [selectedDemoId, setSelectedDemoId] = useState<DemoGoal['id'] | null>(
    DEMO_GOALS[0]?.id ?? null,
  )
  const [customGoal, setCustomGoal] = useState('')
  const [agentState, setAgentState] = useState<AgentState>(IDLE_STATE)
  const [runError, setRunError] = useState<string | null>(null)
  const runtimeRef = useRef<AgentRuntime | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadCapabilities().then((next) => {
      if (!cancelled) {
        setSnapshot(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadCapabilities])

  function instructionForRun(): string {
    const custom = customGoal.trim()
    if (custom) {
      return custom
    }
    const demo = DEMO_GOALS.find((goal) => goal.id === selectedDemoId)
    return demo?.instruction ?? ''
  }

  async function handleRun() {
    const instruction = instructionForRun()
    if (!instruction || agentState.status === 'running') {
      return
    }

    setRunError(null)
    const runtime = createRuntime()
    runtimeRef.current = runtime
    setAgentState({
      ...IDLE_STATE,
      status: 'running',
      goal: { instruction },
    })

    const poll = window.setInterval(() => {
      setAgentState(runtime.getState())
    }, 80)

    try {
      const tabId = await resolveTabId()
      const next = await runtime.run({
        goal: { instruction },
        tabId,
      })
      setAgentState(next)
      if (next.status === 'failed' && next.error) {
        setRunError(next.error)
      }
      const refreshed = await loadCapabilities()
      setSnapshot(refreshed)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent run failed'
      setRunError(message)
      setAgentState(runtime.getState().status === 'idle'
        ? {
            ...IDLE_STATE,
            status: 'failed',
            goal: { instruction },
            error: message,
            events: [
              {
                type: 'agent_failed',
                at: Date.now(),
                reason: message,
              },
            ],
          }
        : {
            ...runtime.getState(),
            status: 'failed',
            error: message,
          })
    } finally {
      window.clearInterval(poll)
      const latest = runtimeRef.current?.getState()
      if (latest) {
        setAgentState(latest)
        if (latest.status === 'failed' && latest.error) {
          setRunError(latest.error)
        }
      }
    }
  }

  const unsupportedCapabilities =
    agentState.status === 'failed' &&
    typeof agentState.error === 'string' &&
    agentState.error.toLowerCase().includes('missing required capabilities')

  return (
    <main className="shell">
      <header className="shell__header">
        <h1>{APP_TITLE}</h1>
        <p className="shell__subtitle">Local AgentRuntime · observable Plan / Trace / Result</p>
      </header>

      <GoalControls
        selectedDemoId={selectedDemoId}
        customGoal={customGoal}
        running={agentState.status === 'running'}
        onSelectDemo={(goal) => {
          setSelectedDemoId(goal.id)
          setCustomGoal('')
        }}
        onCustomGoalChange={(value) => {
          setCustomGoal(value)
          if (value.trim().length > 0) {
            setSelectedDemoId(null)
          } else if (selectedDemoId === null) {
            setSelectedDemoId(DEMO_GOALS[0]?.id ?? null)
          }
        }}
        onRun={() => {
          void handleRun()
        }}
      />

      <CapabilityStrip snapshot={snapshot} />

      <AgentStatusView status={agentState.status} />

      <AgentTrace events={agentState.events} />

      {runError || agentState.error ? (
        <section
          className="run-error"
          aria-label={unsupportedCapabilities ? 'Unsupported capability' : 'Run error'}
          data-kind={unsupportedCapabilities ? 'unsupported' : 'error'}
        >
          <h2 className="section-title">
            {unsupportedCapabilities ? 'Unsupported capability' : 'Error'}
          </h2>
          <p className="run-error__message">{runError ?? agentState.error}</p>
        </section>
      ) : null}

      <ResultView workflowId={agentState.workflowId} result={agentState.result} />
    </main>
  )
}
