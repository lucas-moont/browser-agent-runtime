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

export const APP_TITLE = 'Browser Agent Runtime'

const THREAD_NEAR_BOTTOM_PX = 80

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
  detectMessageLanguage = async (text, fallback) => {
    try {
      return await detectMessagePreferredLanguage(text, { fallback })
    } catch {
      return fallback
    }
  },
  workspace = createChromeAgentWorkspace(),
}: AppProps = {}) {
  const makeRuntime =
    createRuntime ?? (() => createSidePanelRuntime(createSidePanelCapabilityRegistry(), workspace))
  const languageSelectId = useId()
  const threadRef = useRef<HTMLDivElement | null>(null)
  const stickThreadToBottomRef = useRef(true)
  const runtimeRef = useRef<AgentRuntime | null>(null)
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

  async function refreshWorkspace(nextGroupId?: number) {
    try {
      const id = nextGroupId ?? (await workspace.ensureWorkspace())
      setGroupId(id)
      const tabs = await workspace.listTabs(id)
      setWorkspaceTabs(tabs)
      setWorkspaceError(undefined)
      return id
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Workspace unavailable')
      return undefined
    }
  }

  async function inviteCurrentTab() {
    const tabId = await resolveTabId()
    if (typeof tabId !== 'number') {
      setWorkspaceError('No active tab to invite')
      return
    }
    const id = (await refreshWorkspace()) ?? groupId
    if (typeof id !== 'number') {
      return
    }
    try {
      await workspace.inviteTab(id, tabId)
      await refreshWorkspace(id)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Invite failed')
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
    let cancelled = false
    void refreshWorkspace().then(() => {
      if (cancelled) {
        return
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount ensure once
  }, [])

  useEffect(() => {
    const el = threadRef.current
    if (!el || !stickThreadToBottomRef.current) {
      return
    }
    el.scrollTop = el.scrollHeight
  }, [messages, running])

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
    const id = await refreshWorkspace(groupId)
    if (typeof id !== 'number') {
      return undefined
    }
    if (typeof tabId === 'number') {
      const members = await workspace.listTabs(id)
      if (!members.some((tab) => tab.tabId === tabId)) {
        try {
          await workspace.inviteTab(id, tabId)
          await refreshWorkspace(id)
        } catch {
          // invite may fail on restricted URLs; still run with existing members
        }
      }
    }
    return id
  }

  async function sendGoal(instruction: string) {
    const trimmed = instruction.trim()
    if (!trimmed || running) {
      return
    }

    const preferred = await resolvePreferredForMessage(trimmed)
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
    stickThreadToBottomRef.current = true
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
      const tabId = await resolveTabId()
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
          <div className="workspace-strip__title">
            Workspace · Browser Agent · {workspaceTabs.length} tab
            {workspaceTabs.length === 1 ? '' : 's'}
          </div>
          {workspaceTabs.length === 0 ? (
            <p className="workspace-strip__empty">No tabs in workspace — Add current tab</p>
          ) : (
            <ol className="workspace-strip__tabs">
              {workspaceTabs.map((tab) => (
                <li key={tab.tabId} title={tab.url}>
                  {tab.title || tab.url || `Tab ${tab.tabId}`}
                </li>
              ))}
            </ol>
          )}
          <div className="workspace-strip__actions">
            <button type="button" disabled={running} onClick={() => void inviteCurrentTab()}>
              Add current tab
            </button>
          </div>
          {workspaceError ? <p className="workspace-strip__error">{workspaceError}</p> : null}
        </div>
      </header>

      <div
        className="chat-thread"
        ref={threadRef}
        aria-label="Conversation"
        onScroll={handleThreadScroll}
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
