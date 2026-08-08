import {
  DEFAULT_FOUNDATION_LANGUAGE,
  asFoundationLanguage,
  isFoundationLanguage,
  primaryLanguageTag,
  type FoundationLanguage,
} from './foundationLanguage'

export const PREFERRED_LANGUAGES = ['en', 'ja', 'es', 'de', 'fr', 'pt'] as const

export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number]

const PREFERRED_LANGUAGE_SET = new Set<string>(PREFERRED_LANGUAGES)

export { isFoundationLanguage }

export function parsePreferredLanguage(value: unknown): PreferredLanguage {
  if (typeof value !== 'string') {
    return DEFAULT_FOUNDATION_LANGUAGE
  }
  const primary = primaryLanguageTag(value)
  if (PREFERRED_LANGUAGE_SET.has(primary)) {
    return primary as PreferredLanguage
  }
  return DEFAULT_FOUNDATION_LANGUAGE
}

export function needsOutboundTranslation(preferred: string): boolean {
  return !isFoundationLanguage(preferred)
}

export function workingFoundationLanguage(preferred: string): FoundationLanguage {
  return asFoundationLanguage(preferred) ?? DEFAULT_FOUNDATION_LANGUAGE
}
