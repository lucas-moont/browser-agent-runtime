import { useEffect, useState } from 'react'
import { createChromeAiCapabilityProbe } from '../adapters/chrome-ai/createChromeAiCapabilityProbe'
import {
  createCapabilityRegistry,
  type CapabilitySnapshot,
} from '../capabilities/CapabilityRegistry'
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

  return (
    <main className="shell">
      <h1>{APP_TITLE}</h1>
      <CapabilityStrip snapshot={snapshot} />
    </main>
  )
}
