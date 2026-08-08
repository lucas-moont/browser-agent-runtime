import type { FoundationLanguage } from '../../runtime/foundationLanguage'

export type LanguageDetection = {
  detectedLanguage: string
  confidence: number
}

export type LanguageDetectorPort = {
  detect(text: string): Promise<LanguageDetection[]>
}

export type TranslatorPort = {
  translate(
    text: string,
    options: { sourceLanguage: string; targetLanguage: string },
  ): Promise<string>
}

export type SummarizerType = 'key-points' | 'tldr' | 'teaser' | 'headline'
export type SummarizerLength = 'short' | 'medium' | 'long'
export type SummarizerFormat = 'markdown' | 'plain-text'

export type SummarizeOptions = {
  type?: SummarizerType
  length?: SummarizerLength
  format?: SummarizerFormat
  outputLanguage?: FoundationLanguage
  expectedInputLanguages?: string[]
  context?: string
}

export type SummarizerPort = {
  summarize(text: string, options?: SummarizeOptions): Promise<string>
}

export type PromptOptions = {
  responseConstraint?: Record<string, unknown>
  omitResponseConstraintInput?: boolean
}

export type PromptPort = {
  prompt(input: string, options?: PromptOptions): Promise<string>
}

export type CapabilityReadinessPort = {
  getReadiness(
    id: 'languageDetector' | 'summarizer' | 'translator' | 'prompt',
    options?: { sourceLanguage?: string; targetLanguage?: string },
  ): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>
}
