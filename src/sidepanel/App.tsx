import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { resolveActiveTabId } from '../adapters/chrome-messaging'
import {
  createChromeAgentWorkspace,
  type AgentWorkspacePort,
  type WorkspaceTabInfo,
} from '../adapters/chrome-workspace'
import type { CapabilitySnapshot } from '../capabilities/CapabilityRegistry'
import {
  DEMO_GOALS,
  PREFERRED_LANGUAGES,
  parsePreferredLanguage,
  workingFoundationLanguage,
  type AgentEvent,
  type AgentRuntime,
  type AgentState,
  type ConversationTurn,
  type LanguagePreferenceMode,
  type PreferredLanguage,
  type WorkflowId,
} from '../runtime'
import { AgentTrace } from './AgentTrace'
import { CapabilityStrip } from './CapabilityStrip'
import {
  createSidePanelCapabilityRegistry,
  createSidePanelRuntime,
} from './createSidePanelRuntime'
import { detectMessagePreferredLanguage } from './detectMessageLanguage'
import { ResultView } from './ResultView'
import { runningStatusFromEvents } from './runningStatus'

export const APP_TITLE = 'Browser Agent Runtime'

const THREAD_NEAR_BOTTOM_PX = 80

export function readHomeTabId(search = typeof window !== 'undefined' ? window.location.search : ''): number | undefined {
  const raw = new URLSearchParams(search).get('homeTabId')
  if (!raw) {
    return undefined
  }
  const tabId = Number(raw)
  return Number.isFinite(tabId) ? tabId : undefined
}

export function isThreadNearBottom(
  el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  thresholdPx = THREAD_NEAR_BOTTOM_PX,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx
}

export const DEFAULT_CAPABILITY_SNAPSHOT: CapabilitySnapshot = {
  languageDetector: 'unavailable',
  summarizer: 'unavailable',
  translator: 'unavailable',
  prompt: 'unavailable',
}

const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  en: 'English',
  ja: 'Japanese',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  pt: 'Portuguese',
}

type UserMessage = {
  id: string
  role: 'user'
  instruction: string
}

type AssistantMessage = {
  id: string
  role: 'assistant'
  status: AgentState['status']
  workflowId?: WorkflowId
  result?: unknown
  events: AgentEvent[]
  error?: string
}

type ConversationMessage = UserMessage | AssistantMessage

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
  /** Tab that opened this side-panel instance (from `?homeTabId=`). */
  homeTabId?: number
  resolveTabId?: () => Promise<number | undefined>
  loadCapabilities?: (preferredLanguage?: PreferredLanguage) => Promise<CapabilitySnapshot>
  detectMessageLanguage?: (text: string, fallback: PreferredLanguage) => Promise<PreferredLanguage>
  workspace?: AgentWorkspacePort
}

function nextMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function unsupportedCapability(error: string | undefined): boolean {
  return typeof error === 'string' && error.toLowerCase().includes('missing required capabilities')
}

export function App({
  createRuntime,
  homeTabId: homeTabIdProp,
  resolveTabId,
  loadCapabilities = async (preferredLanguage = 'en') => {
    const registry = createSidePanelCapabilityRegistry()
    const preferred = parsePreferredLanguage(preferredLanguage)
    return registry.snapshot({
      translator: {
        sourceLanguage: workingFoundationLanguage(preferred),
        targetLanguage: preferred,
      },
    })
  },
  detectMessageLanguage = async (text, fallback) => {
    try {
      return await detectMessagePreferredLanguage(text, { fallback })
    } catch {
      return fallback
    }
  },
  workspace = createChromeAgentWorkspace(),
}: AppProps = {}) {
  const homeTabId = homeTabIdProp ?? readHomeTabId()
  const resolveHomeTabId =
    resolveTabId ??
    (async () => {
      if (typeof homeTabId === 'number') {
        return homeTabId
      }
      try {
        return await resolveActiveTabId()
      } catch {
        return undefined
      }
    })
  const makeRuntime =
    createRuntime ?? (() => createSidePanelRuntime(createSidePanelCapabilityRegistry(), workspace))
  const languageSelectId = useId()
  const threadRef = useRef<HTMLDivElement | null>(null)
  const stickThreadToBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const runLockRef = useRef(false)
  const runtimeRef = useRef<AgentRuntime | null>(null)
  const sessionStartedRef = useRef(false)
  const [snapshot, setSnapshot] = useState<CapabilitySnapshot>(DEFAULT_CAPABILITY_SNAPSHOT)
  const [languageMode, setLanguageMode] = useState<LanguagePreferenceMode>('auto')
  const [lastDetectedLanguage, setLastDetectedLanguage] = useState<PreferredLanguage>('en')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [running, setRunning] = useState(false)
  const [groupId, setGroupId] = useState<number | undefined>()
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTabInfo[]>([])
  const [workspaceError, setWorkspaceError] = useState<string | undefined>()

  const effectivePreferred =
    languageMode === 'auto' ? lastDetectedLanguage : languageMode

  async function refreshWorkspace(sessionGroupId: number) {
    try {
      setGroupId(sessionGroupId)
      const tabs = await workspace.listTabs(sessionGroupId)
      setWorkspaceTabs(tabs)
      setWorkspaceError(undefined)
      return sessionGroupId
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Workspace unavailable')
      return undefined
    }
  }

  async function startSessionForHomeTab() {
    const seedTabId = await resolveHomeTabId()
    if (typeof seedTabId !== 'number') {
      setWorkspaceError('Open the extension from an http(s) page tab')
      return
    }
    try {
      const id = await workspace.createSession(seedTabId)
      await refreshWorkspace(id)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Workspace unavailable')
    }
  }

  useEffect(() => {
    let cancelled = false
    void loadCapabilities(effectivePreferred).then((next) => {
      if (!cancelled) {
        setSnapshot(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadCapabilities, effectivePreferred])

  useEffect(() => {
    if (sessionStartedRef.current) {
      return
    }
    sessionStartedRef.current = true
    void startSessionForHomeTab()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one session per panel instance
  }, [])

  useEffect(() => {
    const el = threadRef.current
    const messageCountGrew = messages.length > prevMessageCountRef.current
    prevMessageCountRef.current = messages.length

    if (!el || !stickThreadToBottomRef.current) {
      return
    }

    if (messageCountGrew || isThreadNearBottom(el)) {
      el.scrollTop = el.scrollHeight
      return
    }

    stickThreadToBottomRef.current = false
  }, [messages])

  function handleThreadWheel(event: { deltaY: number }) {
    if (event.deltaY < 0) {
      stickThreadToBottomRef.current = false
    }
  }

  function handleThreadScroll() {
    const el = threadRef.current
    if (!el) {
      return
    }
    stickThreadToBottomRef.current = isThreadNearBottom(el)
  }
  async function resolvePreferredForMessage(instruction: string): Promise<PreferredLanguage> {
    if (languageMode !== 'auto') {
      return languageMode
    }
    const detected = await detectMessageLanguage(instruction, lastDetectedLanguage)
    setLastDetectedLanguage(detected)
    return detected
  }

  async function prepareWorkspaceForRun(tabId: number | undefined): Promise<number | undefined> {
    if (typeof groupId === 'number') {
      await refreshWorkspace(groupId)
      return groupId
    }
    if (typeof tabId === 'number') {
      try {
        const id = await workspace.createSession(tabId)
        await refreshWorkspace(id)
        return id
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : 'Workspace unavailable')
        return undefined
      }
    }
    return undefined
  }

  async function sendGoal(instruction: string) {
    const trimmed = instruction.trim()
    if (!trimmed || runLockRef.current) {
      return
    }

    runLockRef.current = true
    setRunning(true)
    setDraft('')
    stickThreadToBottomRef.current = true

    const history: ConversationTurn[] = []
    for (const message of messages) {
      if (message.role === 'user') {
        history.push({ role: 'user', content: message.instruction })
        continue
      }
      if (message.role === 'assistant' && message.status === 'completed' && message.result) {
        const result = message.result as { reply?: string; summary?: string }
        const content =
          typeof result.reply === 'string' && result.reply.trim()
            ? result.reply
            : typeof result.summary === 'string' && result.summary.trim()
              ? result.summary
              : 'Completed a structured Result for this page.'
        history.push({ role: 'assistant', content })
      }
    }

    const userMessage: UserMessage = {
      id: nextMessageId('user'),
      role: 'user',
      instruction: trimmed,
    }
    const assistantId = nextMessageId('assistant')
    const placeholder: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      status: 'running',
      events: [],
    }

    setMessages((prev) => [...prev, userMessage, placeholder])

    const runtime = makeRuntime()
    runtimeRef.current = runtime

    const poll = window.setInterval(() => {
      const state = runtime.getState()
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId && message.role === 'assistant'
            ? {
                ...message,
                status: state.status === 'idle' ? 'running' : state.status,
                workflowId: state.workflowId,
                result: state.result,
                events: state.events,
                error: state.error,
              }
            : message,
        ),
      )
    }, 80)

    try {
      const preferred = await resolvePreferredForMessage(trimmed)
      const tabId = await resolveHomeTabId()
      const preparedGroupId = await prepareWorkspaceForRun(tabId)
      const next = await runtime.run({
        goal: {
          instruction: trimmed,
          context: {
            preferredLanguage: preferred,
            conversationHistory: history,
          },
        },
        tabId,
        groupId: preparedGroupId,
      })
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId && message.role === 'assistant'
            ? {
                ...message,
                status: next.status,
                workflowId: next.workflowId,
                result: next.result,
                events: next.events,
                error: next.error,
              }
            : message,
        ),
      )
      const refreshed = await loadCapabilities(preferred)
      setSnapshot(refreshed)
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Agent run failed'
      const latest = runtimeRef.current?.getState() ?? IDLE_STATE
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId && message.role === 'assistant'
            ? {
                ...message,
                status: 'failed',
                workflowId: latest.workflowId,
                result: latest.result,
                events:
                  latest.events.length > 0
                    ? latest.events
                    : [
                        {
                          type: 'agent_failed',
                          at: Date.now(),
                          reason: messageText,
                        },
                      ],
                error: messageText,
              }
            : message,
        ),
      )
    } finally {
      window.clearInterval(poll)
      runLockRef.current = false
      setRunning(false)
      const latest = runtimeRef.current?.getState()
      if (latest) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId && message.role === 'assistant'
              ? {
                  ...message,
                  status: latest.status === 'idle' ? message.status : latest.status,
                  workflowId: latest.workflowId ?? message.workflowId,
                  result: latest.result ?? message.result,
                  events: latest.events.length > 0 ? latest.events : message.events,
                  error: latest.error ?? message.error,
                }
              : message,
          ),
        )
      }
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendGoal(draft)
    }
  }

  const showSuggestions = !running

  return (
    <main className="shell shell--chat">
      <header className="shell__header shell__header--sticky">
        <div className="shell__header-row">
          <div className="shell__brand">
            <span className="shell__signal" aria-hidden="true" />
            <h1>{APP_TITLE}</h1>
          </div>
          <label className="language-select" htmlFor={languageSelectId}>
            <span className="language-select__label">Language</span>
            <select
              id={languageSelectId}
              aria-label="Preferred response language"
              value={languageMode}
              disabled={running}
              onChange={(event) => {
                const value = event.target.value
                if (value === 'auto') {
                  setLanguageMode('auto')
                  return
                }
                setLanguageMode(parsePreferredLanguage(value))
              }}
            >
              <option value="auto">
                Auto
                {languageMode === 'auto' ? ` (${LANGUAGE_LABELS[lastDetectedLanguage]})` : ''}
              </option>
              {PREFERRED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CapabilityStrip snapshot={snapshot} compact />
        <div className="workspace-strip" aria-label="Agent workspace">
          <div className="workspace-strip__badge" aria-hidden="true">
            {Math.max(workspaceTabs.length, 1)}
          </div>
          <div className="workspace-strip__copy">
            <div className="workspace-strip__title">
              Session workspace · {workspaceTabs.length} tab
              {workspaceTabs.length === 1 ? '' : 's'}
            </div>
            {workspaceTabs.length === 0 ? (
              <p className="workspace-strip__empty">
                Linking this tab to a new Browser Agent group…
              </p>
            ) : (
              <ol className="workspace-strip__tabs">
                {workspaceTabs.map((tab) => (
                  <li key={tab.tabId} title={tab.url}>
                    {tab.title || tab.url || `Tab ${tab.tabId}`}
                  </li>
                ))}
              </ol>
            )}
            {workspaceError ? <p className="workspace-strip__error">{workspaceError}</p> : null}
          </div>
        </div>
      </header>

      <div
        className="chat-thread"
        ref={threadRef}
        aria-label="Conversation"
        onScroll={handleThreadScroll}
        onWheel={handleThreadWheel}
        onTouchMove={() => {
          stickThreadToBottomRef.current = false
        }}
      >
        {messages.length === 0 ? (
          <p className="chat-thread__empty">
            Ask anything about this page. Suggestions below are shortcuts — you can type freely.
          </p>
        ) : null}
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <article key={message.id} className="chat-bubble chat-bubble--user" data-role="user">
                <p className="chat-bubble__text">{message.instruction}</p>
              </article>
            )
          }

          const isUnsupported = unsupportedCapability(message.error)

          return (
            <article
              key={message.id}
              className="chat-bubble chat-bubble--assistant"
              data-role="assistant"
              data-status={message.status}
            >
              {message.status === 'running' ? (
                <div className="chat-bubble__thinking" aria-live="polite">
                  <span className="chat-bubble__thinking-pulse" aria-hidden="true" />
                  <p className="chat-bubble__thinking-label">
                    {runningStatusFromEvents(message.events)}
                  </p>
                </div>
              ) : (
                <p className="chat-bubble__status">
                  {message.status === 'completed'
                    ? 'Done'
                    : message.status === 'failed'
                      ? 'Failed'
                      : message.status}
                </p>
              )}

              {message.error ? (
                <div
                  className="run-error run-error--inline"
                  aria-label={isUnsupported ? 'Unsupported capability' : 'Run error'}
                  data-kind={isUnsupported ? 'unsupported' : 'error'}
                >
                  <p className="run-error__message">
                    {isUnsupported ? 'Unsupported capability: ' : null}
                    {message.error}
                  </p>
                </div>
              ) : null}

              {message.status === 'completed' && message.result ? (
                <ResultView
                  workflowId={message.workflowId}
                  result={message.result}
                  compact
                />
              ) : null}

              {message.status !== 'running' && message.events.length > 0 ? (
                <details className="runtime-trace">
                  <summary>Runtime trace</summary>
                  <AgentTrace events={message.events} />
                </details>
              ) : null}
            </article>
          )
        })}
      </div>

      <footer className="chat-composer-dock">
        {showSuggestions ? (
          <div className="suggestion-chips" role="group" aria-label="Suggested prompts">
            {DEMO_GOALS.map((goal) => (
              <button
                key={goal.id}
                type="button"
                className="suggestion-chips__chip"
                disabled={running}
                onClick={() => {
                  void sendGoal(goal.instruction)
                }}
              >
                {goal.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="chat-composer">
          <textarea
            className="chat-composer__input"
            rows={2}
            value={draft}
            disabled={running}
            placeholder="Ask anything about this page…"
            aria-label="Message"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
          />
          <button
            type="button"
            className="chat-composer__send"
            disabled={running || draft.trim().length === 0}
            aria-label="Send"
            onClick={() => {
              void sendGoal(draft)
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M3.4 20.6 20.95 12 3.4 3.4l.1 6.85L15.1 12 3.5 13.75l-.1 6.85Z"
              />
            </svg>
          </button>
        </div>
      </footer>
    </main>
  )
}
