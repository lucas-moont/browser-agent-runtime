import {
  DEFAULT_FOUNDATION_LANGUAGE,
  asFoundationLanguage,
  isFoundationLanguage,
  primaryLanguageTag,
  type FoundationLanguage,
} from './foundationLanguage'

export const PREFERRED_LANGUAGES = ['en', 'ja', 'es', 'de', 'fr', 'pt'] as const

export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number]

export type LanguagePreferenceMode = 'auto' | PreferredLanguage

const PREFERRED_LANGUAGE_SET = new Set<string>(PREFERRED_LANGUAGES)

export { isFoundationLanguage }

export function tryParsePreferredLanguage(value: unknown): PreferredLanguage | null {
  if (typeof value !== 'string') {
    return null
  }
  const primary = primaryLanguageTag(value)
  if (PREFERRED_LANGUAGE_SET.has(primary)) {
    return primary as PreferredLanguage
  }
  return null
}

export function parsePreferredLanguage(value: unknown): PreferredLanguage {
  return tryParsePreferredLanguage(value) ?? DEFAULT_FOUNDATION_LANGUAGE
}

export function needsOutboundTranslation(preferred: string): boolean {
  return !isFoundationLanguage(preferred)
}

export function workingFoundationLanguage(preferred: string): FoundationLanguage {
  return asFoundationLanguage(preferred) ?? DEFAULT_FOUNDATION_LANGUAGE
}

export type LanguageDetectionHit = {
  detectedLanguage: string
  confidence: number
}

/** Pick a supported PreferredLanguage from detector hits; otherwise fallback. */
export function preferredLanguageFromDetections(
  detections: readonly LanguageDetectionHit[],
  options?: { minConfidence?: number; fallback?: PreferredLanguage },
): PreferredLanguage {
  const minConfidence = options?.minConfidence ?? 0.35
  const fallback = options?.fallback ?? DEFAULT_FOUNDATION_LANGUAGE

  const ranked = [...detections].sort((a, b) => b.confidence - a.confidence)
  for (const hit of ranked) {
    if (hit.confidence < minConfidence) {
      continue
    }
    const parsed = tryParsePreferredLanguage(hit.detectedLanguage)
    if (parsed) {
      return parsed
    }
  }
  return fallback
}
