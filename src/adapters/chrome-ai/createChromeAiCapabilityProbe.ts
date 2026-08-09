import type {
  CapabilityId,
  CapabilityProbe,
  CapabilityReadiness,
} from '../../capabilities/CapabilityRegistry'
import { DEFAULT_FOUNDATION_LANGUAGE } from '../../runtime/foundationLanguage'

export type ChromeAiAvailabilityStatus =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

export type ChromeAiAvailabilityApi = {
  availability(options?: Record<string, unknown>): Promise<ChromeAiAvailabilityStatus | string>
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

function summarizerLanguageOptions(outputLanguage: string): Record<string, unknown> {
  return {
    outputLanguage,
    expectedInputLanguages: [outputLanguage],
    expectedContextLanguages: [outputLanguage],
  }
}

function promptLanguageOptions(outputLanguage: string): Record<string, unknown> {
  return {
    expectedInputs: [{ type: 'text', languages: [outputLanguage] }],
    expectedOutputs: [{ type: 'text', languages: [outputLanguage] }],
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

      let status: ChromeAiAvailabilityStatus | string
      if (id === 'translator') {
        status = await api.availability({
          sourceLanguage: options?.sourceLanguage,
          targetLanguage: options?.targetLanguage,
        })
      } else if (id === 'summarizer') {
        const outputLanguage = options?.outputLanguage ?? DEFAULT_FOUNDATION_LANGUAGE
        status = await api.availability(summarizerLanguageOptions(outputLanguage))
      } else if (id === 'prompt') {
        const outputLanguage = options?.outputLanguage ?? DEFAULT_FOUNDATION_LANGUAGE
        status = await api.availability(promptLanguageOptions(outputLanguage))
      } else {
        status = await api.availability()
      }

      return normalizeReadiness(String(status))
    },
  }
}
