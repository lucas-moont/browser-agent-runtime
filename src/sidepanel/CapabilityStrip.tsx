import type { CapabilityId, CapabilityReadiness, CapabilitySnapshot } from '../capabilities/CapabilityRegistry'

const LABELS: Record<CapabilityId, string> = {
  languageDetector: 'Language Detector',
  summarizer: 'Summarizer',
  translator: 'Translator',
  prompt: 'Prompt',
}

const STATUS_COPY: Record<CapabilityReadiness, string> = {
  available: 'Available',
  downloadable: 'Downloadable',
  downloading: 'Downloading',
  unavailable: 'Unavailable — enable Built-in AI or use a supported device',
}

const ORDER: CapabilityId[] = ['languageDetector', 'summarizer', 'translator', 'prompt']

export function CapabilityStrip({ snapshot }: { snapshot: CapabilitySnapshot }) {
  return (
    <section className="capability-strip" aria-label="Built-in AI capabilities">
      <h2 className="capability-strip__title">Capabilities</h2>
      <ul className="capability-strip__list">
        {ORDER.map((id) => {
          const readiness = snapshot[id]
          return (
            <li key={id} className="capability-strip__item" data-readiness={readiness}>
              <span className="capability-strip__name">{LABELS[id]}</span>
              <span className="capability-strip__status">{STATUS_COPY[readiness]}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
