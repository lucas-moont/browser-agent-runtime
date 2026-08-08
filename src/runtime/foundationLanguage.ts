export const FOUNDATION_LANGUAGES = ['en', 'ja', 'es', 'de', 'fr'] as const

export type FoundationLanguage = (typeof FOUNDATION_LANGUAGES)[number]

export const DEFAULT_FOUNDATION_LANGUAGE: FoundationLanguage = 'en'

const FOUNDATION_LANGUAGE_SET = new Set<string>(FOUNDATION_LANGUAGES)

export function primaryLanguageTag(code: string): string {
  const trimmed = code.trim().toLowerCase()
  if (!trimmed) {
    return trimmed
  }
  return trimmed.split('-')[0] ?? trimmed
}

export function isFoundationLanguage(code: string): code is FoundationLanguage {
  return FOUNDATION_LANGUAGE_SET.has(primaryLanguageTag(code))
}

export function asFoundationLanguage(code: string): FoundationLanguage | undefined {
  const primary = primaryLanguageTag(code)
  return FOUNDATION_LANGUAGE_SET.has(primary) ? (primary as FoundationLanguage) : undefined
}

export type TranslateFn = (
  text: string,
  options: { sourceLanguage: string; targetLanguage: string },
) => Promise<string>

export type NormalizeToFoundationLanguageResult = {
  text: string
  sourceLanguage: string
  foundationLanguage: FoundationLanguage
  translatedInbound: boolean
}

export type NormalizeToFoundationLanguageOptions = {
  targetFoundationLanguage?: FoundationLanguage
  translate: TranslateFn
}

export async function normalizeToFoundationLanguage(
  text: string,
  sourceLanguage: string,
  options: NormalizeToFoundationLanguageOptions,
): Promise<NormalizeToFoundationLanguageResult> {
  const source = primaryLanguageTag(sourceLanguage)
  const target = options.targetFoundationLanguage ?? DEFAULT_FOUNDATION_LANGUAGE
  const alreadyFoundation = asFoundationLanguage(source)

  if (alreadyFoundation) {
    return {
      text,
      sourceLanguage: source,
      foundationLanguage: alreadyFoundation,
      translatedInbound: false,
    }
  }

  const translated = await options.translate(text, {
    sourceLanguage: source,
    targetLanguage: target,
  })

  return {
    text: translated,
    sourceLanguage: source,
    foundationLanguage: target,
    translatedInbound: true,
  }
}
