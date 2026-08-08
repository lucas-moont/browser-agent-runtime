import { describe, expect, it, vi } from 'vitest'
import {
  asFoundationLanguage,
  isFoundationLanguage,
  normalizeToFoundationLanguage,
  primaryLanguageTag,
} from './foundationLanguage'

describe('FoundationLanguage helpers', () => {
  it('recognizes foundation language codes and rejects pt', () => {
    expect(isFoundationLanguage('en')).toBe(true)
    expect(isFoundationLanguage('ja')).toBe(true)
    expect(isFoundationLanguage('es')).toBe(true)
    expect(isFoundationLanguage('de')).toBe(true)
    expect(isFoundationLanguage('fr')).toBe(true)
    expect(isFoundationLanguage('pt')).toBe(false)
    expect(isFoundationLanguage('en-US')).toBe(true)
    expect(asFoundationLanguage('FR')).toBe('fr')
    expect(asFoundationLanguage('pt-BR')).toBeUndefined()
    expect(primaryLanguageTag('pt-BR')).toBe('pt')
  })

  it('skips inbound translate when source is already a FoundationLanguage', async () => {
    const translate = vi.fn(async () => 'should-not-run')

    const result = await normalizeToFoundationLanguage('Hello world', 'en', { translate })

    expect(result).toEqual({
      text: 'Hello world',
      sourceLanguage: 'en',
      foundationLanguage: 'en',
      translatedInbound: false,
    })
    expect(translate).not.toHaveBeenCalled()
  })

  it('translates inbound text when source is pt', async () => {
    const translate = vi.fn(async (text, options) => {
      expect(options).toEqual({ sourceLanguage: 'pt', targetLanguage: 'en' })
      return `EN:${text}`
    })

    const result = await normalizeToFoundationLanguage('Olá mundo', 'pt', { translate })

    expect(result).toEqual({
      text: 'EN:Olá mundo',
      sourceLanguage: 'pt',
      foundationLanguage: 'en',
      translatedInbound: true,
    })
    expect(translate).toHaveBeenCalledOnce()
  })
})
