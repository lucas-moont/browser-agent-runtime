import { useEffect, useState } from 'react'
import { createChromeAiCapabilityProbe } from '../adapters/chrome-ai/createChromeAiCapabilityProbe'
import {
  createChromeMessagingTransport,
  resolveActiveTabId,
} from '../adapters/chrome-messaging'
import {
  createCapabilityRegistry,
  type CapabilitySnapshot,
} from '../capabilities/CapabilityRegistry'
import type { PageContextInspection } from '../messaging'
import { createToolRegistry, registerPageTools } from '../tools'
import { CapabilityStrip } from './CapabilityStrip'

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

export function App() {
  const [snapshot, setSnapshot] = useState<CapabilitySnapshot>(DEFAULT_CAPABILITY_SNAPSHOT)
  const [pageContext, setPageContext] = useState<PageContextInspection | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageBusy, setPageBusy] = useState(false)

  useEffect(() => {
    const registry = createCapabilityRegistry(createChromeAiCapabilityProbe())
    let cancelled = false

    void registry.snapshot({ translator: DEFAULT_TRANSLATOR_PAIR }).then((next) => {
      if (!cancelled) {
        setSnapshot(next)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleInspectPageContext() {
    setPageBusy(true)
    setPageError(null)
    try {
      const tabId = await resolveActiveTabId()
      const registry = createToolRegistry()
      registerPageTools(registry, {
        transport: createChromeMessagingTransport(),
      })
      const context = (await registry.execute('inspectPageContext', {}, { tabId })) as PageContextInspection
      setPageContext(context)
    } catch (error) {
      setPageContext(null)
      setPageError(error instanceof Error ? error.message : 'Failed to inspect page context')
    } finally {
      setPageBusy(false)
    }
  }

  return (
    <main className="shell">
      <h1>{APP_TITLE}</h1>
      <CapabilityStrip snapshot={snapshot} />
      <section className="page-context">
        <h2 className="page-context__title">Page context</h2>
        <button
          type="button"
          className="page-context__button"
          onClick={() => {
            void handleInspectPageContext()
          }}
          disabled={pageBusy}
        >
          {pageBusy ? 'Inspecting…' : 'Inspect active page'}
        </button>
        {pageError ? <p className="page-context__error">{pageError}</p> : null}
        {pageContext ? (
          <dl className="page-context__details">
            <div>
              <dt>Title</dt>
              <dd>{pageContext.title}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{pageContext.url}</dd>
            </div>
            <div>
              <dt>Selection</dt>
              <dd>
                {pageContext.hasSelection
                  ? `${pageContext.selectionLength} chars`
                  : 'none'}
              </dd>
            </div>
            <div>
              <dt>Main text</dt>
              <dd>{pageContext.mainTextLength} chars</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  )
}
