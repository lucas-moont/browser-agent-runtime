import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { resolveActiveTabId } from '../adapters/chrome-messaging'
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
  type PreferredLanguage,
  type WorkflowId,
} from '../runtime'
import { AgentTrace } from './AgentTrace'
import { CapabilityStrip } from './CapabilityStrip'
import {
  createSidePanelCapabilityRegistry,
  createSidePanelRuntime,
} from './createSidePanelRuntime'
import { ResultView } from './ResultView'

export const APP_TITLE = 'Browser Agent Runtime'

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
  resolveTabId?: () => Promise<number | undefined>
  loadCapabilities?: (preferredLanguage?: PreferredLanguage) => Promise<CapabilitySnapshot>
}

function nextMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function unsupportedCapability(error: string | undefined): boolean {
  return typeof error === 'string' && error.toLowerCase().includes('missing required capabilities')
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
}: AppProps = {}) {
  const languageSelectId = useId()
  const threadRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<AgentRuntime | null>(null)
  const [snapshot, setSnapshot] = useState<CapabilitySnapshot>(DEFAULT_CAPABILITY_SNAPSHOT)
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>('en')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadCapabilities(preferredLanguage).then((next) => {
      if (!cancelled) {
        setSnapshot(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadCapabilities, preferredLanguage])

  useEffect(() => {
    const el = threadRef.current
    if (!el) {
      return
    }
    el.scrollTop = el.scrollHeight
  }, [messages, running])

  async function sendGoal(instruction: string) {
    const trimmed = instruction.trim()
    if (!trimmed || running) {
      return
    }

    const preferred = parsePreferredLanguage(preferredLanguage)
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

    setDraft('')
    setRunning(true)
    setMessages((prev) => [...prev, userMessage, placeholder])

    const runtime = createRuntime()
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
      const tabId = await resolveTabId()
      const next = await runtime.run({
        goal: {
          instruction: trimmed,
          context: {
            preferredLanguage: preferred,
            conversationHistory: history,
          },
        },
        tabId,
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
          <h1>{APP_TITLE}</h1>
          <label className="language-select" htmlFor={languageSelectId}>
            <span className="language-select__label">Language</span>
            <select
              id={languageSelectId}
              aria-label="Preferred response language"
              value={preferredLanguage}
              disabled={running}
              onChange={(event) => {
                setPreferredLanguage(parsePreferredLanguage(event.target.value))
              }}
            >
              {PREFERRED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CapabilityStrip snapshot={snapshot} compact />
      </header>

      <div className="chat-thread" ref={threadRef} aria-label="Conversation">
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
              <p className="chat-bubble__status">
                {message.status === 'running'
                  ? 'Running…'
                  : message.status === 'completed'
                    ? 'Completed'
                    : message.status === 'failed'
                      ? 'Failed'
                      : message.status}
              </p>

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

              {message.events.length > 0 ? (
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
            onClick={() => {
              void sendGoal(draft)
            }}
          >
            Send
          </button>
        </div>
      </footer>
    </main>
  )
}
