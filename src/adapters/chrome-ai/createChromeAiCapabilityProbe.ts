import type {
  CapabilityId,
  CapabilityProbe,
  CapabilityProbeOptions,
  CapabilityReadiness,
} from '../../capabilities/CapabilityRegistry'

export type ChromeAiAvailabilityStatus =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

export type ChromeAiAvailabilityApi = {
  availability(options?: CapabilityProbeOptions): Promise<ChromeAiAvailabilityStatus | string>
}

export type ChromeAiGlobals = {
  LanguageDetector?: ChromeAiAvailabilityApi
  Summarizer?: ChromeAiAvailabilityApi
  Translator?: ChromeAiAvailabilityApi
  LanguageModel?: ChromeAiAvailabilityApi
}

const READINESS = new Set<CapabilityReadiness>([
  'unavailable',
  'downloadable',
  'downloading',
  'available',
])

function normalizeReadiness(value: string): CapabilityReadiness {
  return READINESS.has(value as CapabilityReadiness)
    ? (value as CapabilityReadiness)
    : 'unavailable'
}

function resolveApi(globals: ChromeAiGlobals, id: CapabilityId): ChromeAiAvailabilityApi | undefined {
  switch (id) {
    case 'languageDetector':
      return globals.LanguageDetector
    case 'summarizer':
      return globals.Summarizer
    case 'translator':
      return globals.Translator
    case 'prompt':
      return globals.LanguageModel
  }
}

export function createChromeAiCapabilityProbe(
  globals: ChromeAiGlobals = globalThis as ChromeAiGlobals,
): CapabilityProbe {
  return {
    async probe(id, options) {
      const api = resolveApi(globals, id)
      if (!api || typeof api.availability !== 'function') {
        return 'unavailable'
      }

      const status =
        id === 'translator'
          ? await api.availability({
              sourceLanguage: options?.sourceLanguage,
              targetLanguage: options?.targetLanguage,
            })
          : await api.availability()

      return normalizeReadiness(String(status))
    },
  }
}
