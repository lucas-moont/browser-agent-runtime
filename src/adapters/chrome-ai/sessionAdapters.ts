import type {
  LanguageDetectorPort,
  PromptOptions,
  PromptPort,
  SummarizeOptions,
  SummarizerPort,
  TranslatorPort,
} from './ports'
import type { ChromeAiGlobals } from './createChromeAiCapabilityProbe'
import { DEFAULT_FOUNDATION_LANGUAGE } from '../../runtime/foundationLanguage'

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
  create: (options: {
    type?: string
    length?: string
    format?: string
    outputLanguage: string
    expectedInputLanguages?: string[]
    expectedContextLanguages?: string[]
    sharedContext?: string
    monitor?: unknown
  }) => Promise<{
    summarize: (text: string, options?: { context?: string }) => Promise<string>
    destroy?: () => void
  }>
}

type ChromeLanguageModelApi = {
  create: (options?: {
    monitor?: unknown
    signal?: AbortSignal
    outputLanguage?: string
    expectedInputs?: Array<{ type: string; languages?: string[] }>
    expectedOutputs?: Array<{ type: string; languages?: string[] }>
  }) => Promise<{
    prompt: (
      input: string,
      options?: {
        responseConstraint?: Record<string, unknown>
        omitResponseConstraintInput?: boolean
        signal?: AbortSignal
      },
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
  signal?: AbortSignal,
): Promise<T> {
  const onAbort = () => {
    session.destroy?.()
  }
  if (signal) {
    if (signal.aborted) {
      session.destroy?.()
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException('Cancelled', 'AbortError')
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    return await run()
  } finally {
    signal?.removeEventListener('abort', onAbort)
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
      return withSession(session, () => session.translate(text), options.signal)
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
      const outputLanguage = options.outputLanguage ?? DEFAULT_FOUNDATION_LANGUAGE
      const expectedInputLanguages = options.expectedInputLanguages?.length
        ? options.expectedInputLanguages
        : [outputLanguage]
      const createOptions: {
        outputLanguage: string
        expectedInputLanguages: string[]
        expectedContextLanguages: string[]
        type?: string
        length?: string
        format?: string
      } = {
        outputLanguage,
        expectedInputLanguages,
        expectedContextLanguages: [outputLanguage],
      }
      if (options.type) {
        createOptions.type = options.type
      }
      if (options.length) {
        createOptions.length = options.length
      }
      if (options.format) {
        createOptions.format = options.format
      }
      const session = await api.create(createOptions)
      return withSession(
        session,
        () =>
          session.summarize(
            text,
            options.context !== undefined ? { context: options.context } : undefined,
          ),
        options.signal,
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
      const language = options.outputLanguage ?? DEFAULT_FOUNDATION_LANGUAGE
      const session = await api.create({
        signal: options.signal,
        outputLanguage: language,
        expectedInputs: [{ type: 'text', languages: [language] }],
        expectedOutputs: [{ type: 'text', languages: [language] }],
      })
      return withSession(
        session,
        () =>
          session.prompt(input, {
            responseConstraint: options.responseConstraint,
            omitResponseConstraintInput: options.omitResponseConstraintInput,
            signal: options.signal,
          }),
        options.signal,
      )
    },
  }
}

export type ModelDownloadProgress = {
  loaded: number
}

/**
 * Trigger Built-in AI model download via LanguageModel.create + monitor.
 * Requires a user gesture. Resolves when create completes (model ready / session destroyed).
 */
export async function downloadPromptModel(options?: {
  globals?: ChromeAiSessionGlobals
  signal?: AbortSignal
  onProgress?: (progress: ModelDownloadProgress) => void
}): Promise<void> {
  const globals = options?.globals ?? (globalThis as ChromeAiSessionGlobals)
  const api = globals.LanguageModel
  if (!api || typeof api.create !== 'function') {
    throw new Error('LanguageModel API is unavailable')
  }
  const session = await api.create({
    signal: options?.signal,
    outputLanguage: DEFAULT_FOUNDATION_LANGUAGE,
    expectedInputs: [{ type: 'text', languages: [DEFAULT_FOUNDATION_LANGUAGE] }],
    expectedOutputs: [{ type: 'text', languages: [DEFAULT_FOUNDATION_LANGUAGE] }],
    monitor(m: { addEventListener: (type: string, listener: (e: { loaded: number }) => void) => void }) {
      m.addEventListener('downloadprogress', (e) => {
        options?.onProgress?.({ loaded: e.loaded })
      })
    },
  })
  session.destroy?.()
}
