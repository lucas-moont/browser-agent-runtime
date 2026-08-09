import type { CapabilityId, CapabilityReadiness, CapabilitySnapshot } from '../capabilities/CapabilityRegistry'

const LABELS: Record<CapabilityId, string> = {
  languageDetector: 'Language Detector',
  summarizer: 'Summarizer',
  translator: 'Translator',
  prompt: 'Prompt',
}

const SHORT_LABELS: Record<CapabilityId, string> = {
  languageDetector: 'Detect',
  summarizer: 'Summarize',
  translator: 'Translate',
  prompt: 'Prompt',
}

const STATUS_COPY: Record<CapabilityReadiness, string> = {
  available: 'Available',
  downloadable: 'Downloadable',
  downloading: 'Downloading',
  unavailable: 'Unavailable — enable Built-in AI or use a supported device',
}

const SHORT_STATUS: Record<CapabilityReadiness, string> = {
  available: 'on',
  downloadable: 'dl',
  downloading: '…',
  unavailable: 'off',
}

const ORDER: CapabilityId[] = ['languageDetector', 'summarizer', 'translator', 'prompt']

export function CapabilityStrip({
  snapshot,
  compact = false,
}: {
  snapshot: CapabilitySnapshot
  compact?: boolean
}) {
  return (
    <section
      className={compact ? 'capability-strip capability-strip--compact' : 'capability-strip'}
      aria-label="Built-in AI capabilities"
    >
      {compact ? null : <h2 className="capability-strip__title">Capabilities</h2>}
      <ul className="capability-strip__list">
        {ORDER.map((id) => {
          const readiness = snapshot[id]
          return (
            <li key={id} className="capability-strip__item" data-readiness={readiness}>
              <span className="capability-strip__name">
                {compact ? SHORT_LABELS[id] : LABELS[id]}
              </span>
              <span className="capability-strip__status">
                {compact ? SHORT_STATUS[readiness] : STATUS_COPY[readiness]}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
