import { describe, expect, it } from 'vitest'
import { DEFAULT_FOUNDATION_LANGUAGE, isFoundationLanguage } from './foundationLanguage'
import {
  PREFERRED_LANGUAGES,
  needsOutboundTranslation,
  parsePreferredLanguage,
  preferredLanguageFromDetections,
  tryParsePreferredLanguage,
  workingFoundationLanguage,
} from './preferredLanguage'
import { detectPreferredLanguageFromText } from './detectPreferredLanguage'

describe('preferredLanguage helpers', () => {
  it('lists MVP preferred languages including foundation set and pt', () => {
    expect(PREFERRED_LANGUAGES).toEqual(['en', 'ja', 'es', 'de', 'fr', 'pt'])
    for (const code of ['en', 'ja', 'es', 'de', 'fr']) {
      expect(isFoundationLanguage(code)).toBe(true)
    }
    expect(isFoundationLanguage('pt')).toBe(false)
  })

  it('parsePreferredLanguage normalizes tags and falls back to en', () => {
    expect(parsePreferredLanguage('PT-BR')).toBe('pt')
    expect(parsePreferredLanguage('ja')).toBe('ja')
    expect(parsePreferredLanguage('en-US')).toBe('en')
    expect(parsePreferredLanguage('it')).toBe('en')
    expect(parsePreferredLanguage(undefined)).toBe('en')
    expect(tryParsePreferredLanguage('it')).toBeNull()
    expect(tryParsePreferredLanguage('pt-BR')).toBe('pt')
  })

  it('needsOutboundTranslation only for non-foundation prefs', () => {
    expect(needsOutboundTranslation('pt')).toBe(true)
    expect(needsOutboundTranslation('en')).toBe(false)
  })

  it('workingFoundationLanguage uses preferred when foundation else DEFAULT en', () => {
    expect(workingFoundationLanguage('ja')).toBe('ja')
    expect(workingFoundationLanguage('pt')).toBe(DEFAULT_FOUNDATION_LANGUAGE)
  })

  it('preferredLanguageFromDetections picks best supported hit above confidence', () => {
    expect(
      preferredLanguageFromDetections([
        { detectedLanguage: 'pt-BR', confidence: 0.92 },
        { detectedLanguage: 'en', confidence: 0.1 },
      ]),
    ).toBe('pt')

    expect(
      preferredLanguageFromDetections(
        [{ detectedLanguage: 'it', confidence: 0.99 }],
        { fallback: 'en' },
      ),
    ).toBe('en')

    expect(
      preferredLanguageFromDetections(
        [{ detectedLanguage: 'pt', confidence: 0.1 }],
        { minConfidence: 0.35, fallback: 'fr' },
      ),
    ).toBe('fr')
  })

  it('detectPreferredLanguageFromText uses the detector port', async () => {
    const preferred = await detectPreferredLanguageFromText(
      'Olá, resume esta página por favor',
      {
        detect: async () => [{ detectedLanguage: 'pt', confidence: 0.88 }],
      },
    )
    expect(preferred).toBe('pt')
  })
})
