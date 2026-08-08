import type {
  LanguageDetectorPort,
  PromptOptions,
  PromptPort,
  SummarizeOptions,
  SummarizerPort,
  TranslatorPort,
} from './ports'
import type { ChromeAiGlobals } from './createChromeAiCapabilityProbe'

type Destroyable = { destroy?: () => void }

type ChromeLanguageDetectorApi = {
  create: (options?: { monitor?: unknown }) => Promise<{
    detect: (text: string) => Promise<Array<{ detectedLanguage: string; confidence: number }>>
    destroy?: () => void
  }>
}

type ChromeTranslatorApi = {
  create: (options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: unknown
  }) => Promise<{
    translate: (text: string) => Promise<string>
    destroy?: () => void
  }>
}

type ChromeSummarizerApi = {
  create: (options?: {
    type?: string
    length?: string
    format?: string
    outputLanguage?: string
    expectedInputLanguages?: string[]
    monitor?: unknown
  }) => Promise<{
    summarize: (text: string, options?: { context?: string }) => Promise<string>
    destroy?: () => void
  }>
}

type ChromeLanguageModelApi = {
  create: (options?: { monitor?: unknown }) => Promise<{
    prompt: (
      input: string,
      options?: { responseConstraint?: Record<string, unknown>; omitResponseConstraintInput?: boolean },
    ) => Promise<string>
    destroy?: () => void
  }>
}

type ChromeAiSessionGlobals = ChromeAiGlobals & {
  LanguageDetector?: ChromeAiGlobals['LanguageDetector'] & ChromeLanguageDetectorApi
  Translator?: ChromeAiGlobals['Translator'] & ChromeTranslatorApi
  Summarizer?: ChromeAiGlobals['Summarizer'] & ChromeSummarizerApi
  LanguageModel?: ChromeAiGlobals['LanguageModel'] & ChromeLanguageModelApi
}

async function withSession<T>(
  session: Destroyable,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run()
  } finally {
    session.destroy?.()
  }
}

export function createChromeLanguageDetectorAdapter(
  globals: ChromeAiSessionGlobals = globalThis as ChromeAiSessionGlobals,
): LanguageDetectorPort {
  return {
    async detect(text) {
      const api = globals.LanguageDetector
      if (!api || typeof api.create !== 'function') {
        throw new Error('LanguageDetector API is unavailable')
      }
      const session = await api.create()
      return withSession(session, () => session.detect(text))
    },
  }
}

export function createChromeTranslatorAdapter(
  globals: ChromeAiSessionGlobals = globalThis as ChromeAiSessionGlobals,
): TranslatorPort {
  return {
    async translate(text, options) {
      const api = globals.Translator
      if (!api || typeof api.create !== 'function') {
        throw new Error('Translator API is unavailable')
      }
      const session = await api.create({
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      })
      return withSession(session, () => session.translate(text))
    },
  }
}

export function createChromeSummarizerAdapter(
  globals: ChromeAiSessionGlobals = globalThis as ChromeAiSessionGlobals,
): SummarizerPort {
  return {
    async summarize(text, options: SummarizeOptions = {}) {
      const api = globals.Summarizer
      if (!api || typeof api.create !== 'function') {
        throw new Error('Summarizer API is unavailable')
      }
      const session = await api.create({
        type: options.type,
        length: options.length,
        format: options.format,
        outputLanguage: options.outputLanguage,
        expectedInputLanguages: options.expectedInputLanguages,
      })
      return withSession(session, () =>
        session.summarize(text, options.context !== undefined ? { context: options.context } : undefined),
      )
    },
  }
}

export function createChromePromptAdapter(
  globals: ChromeAiSessionGlobals = globalThis as ChromeAiSessionGlobals,
): PromptPort {
  return {
    async prompt(input, options: PromptOptions = {}) {
      const api = globals.LanguageModel
      if (!api || typeof api.create !== 'function') {
        throw new Error('LanguageModel API is unavailable')
      }
      const session = await api.create()
      return withSession(session, () =>
        session.prompt(input, {
          responseConstraint: options.responseConstraint,
          omitResponseConstraintInput: options.omitResponseConstraintInput,
        }),
      )
    },
  }
}
