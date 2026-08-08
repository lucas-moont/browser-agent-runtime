import type {
  CapabilityReadinessPort,
  LanguageDetection,
  LanguageDetectorPort,
  PromptOptions,
  PromptPort,
  SummarizeOptions,
  SummarizerPort,
  TranslatorPort,
} from './ports'
import type { CapabilityId, CapabilityReadiness } from '../../capabilities/CapabilityRegistry'

export function createFakeLanguageDetector(
  detections: LanguageDetection[] | ((text: string) => LanguageDetection[] | Promise<LanguageDetection[]>),
): LanguageDetectorPort {
  return {
    async detect(text) {
      return typeof detections === 'function' ? await detections(text) : detections
    },
  }
}

export function createFakeTranslator(
  translateImpl:
    | string
    | ((
        text: string,
        options: { sourceLanguage: string; targetLanguage: string },
      ) => string | Promise<string>),
): TranslatorPort {
  return {
    async translate(text, options) {
      if (typeof translateImpl === 'function') {
        return translateImpl(text, options)
      }
      return translateImpl
    },
  }
}

export function createFakeSummarizer(
  summarizeImpl: string | ((text: string, options?: SummarizeOptions) => string | Promise<string>),
): SummarizerPort {
  return {
    async summarize(text, options) {
      if (typeof summarizeImpl === 'function') {
        return summarizeImpl(text, options)
      }
      return summarizeImpl
    },
  }
}

export function createFakePrompt(
  promptImpl: string | ((input: string, options?: PromptOptions) => string | Promise<string>),
): PromptPort {
  return {
    async prompt(input, options) {
      if (typeof promptImpl === 'function') {
        return promptImpl(input, options)
      }
      return promptImpl
    },
  }
}

export function createFakeCapabilityReadiness(
  readiness: Partial<Record<CapabilityId, CapabilityReadiness>> = {},
): CapabilityReadinessPort {
  return {
    async getReadiness(id) {
      return readiness[id] ?? 'unavailable'
    },
  }
}
