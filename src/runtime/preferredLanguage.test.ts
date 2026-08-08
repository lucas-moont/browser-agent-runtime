import { describe, expect, it } from 'vitest'
import { DEFAULT_FOUNDATION_LANGUAGE, isFoundationLanguage } from './foundationLanguage'
import {
  PREFERRED_LANGUAGES,
  needsOutboundTranslation,
  parsePreferredLanguage,
  workingFoundationLanguage,
} from './preferredLanguage'

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
    expect(parsePreferredLanguage(null)).toBe('en')
    expect(parsePreferredLanguage(42)).toBe('en')
  })

  it('needsOutboundTranslation only for non-foundation prefs', () => {
    expect(needsOutboundTranslation('pt')).toBe(true)
    expect(needsOutboundTranslation('en')).toBe(false)
    expect(needsOutboundTranslation('ja')).toBe(false)
    expect(needsOutboundTranslation('fr')).toBe(false)
  })

  it('workingFoundationLanguage uses preferred when foundation else DEFAULT en', () => {
    expect(workingFoundationLanguage('ja')).toBe('ja')
    expect(workingFoundationLanguage('de')).toBe('de')
    expect(workingFoundationLanguage('pt')).toBe(DEFAULT_FOUNDATION_LANGUAGE)
    expect(workingFoundationLanguage('pt')).toBe('en')
  })
})
