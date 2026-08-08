import { describe, expect, it, vi } from 'vitest'
import { createChromeAiCapabilityProbe } from '../adapters/chrome-ai/createChromeAiCapabilityProbe'
import {
  CAPABILITY_IDS,
  CapabilityRegistry,
  UnknownCapabilityError,
  type CapabilityId,
  type CapabilityProbe,
  type CapabilityReadiness,
} from './CapabilityRegistry'

function fakeProbe(
  responses: Partial<Record<CapabilityId, CapabilityReadiness>>,
  onProbe?: (id: CapabilityId, options?: { sourceLanguage?: string; targetLanguage?: string }) => void,
): CapabilityProbe {
  return {
    async probe(id, options) {
      onProbe?.(id, options)
      return responses[id] ?? 'unavailable'
    },
  }
}

describe('CapabilityRegistry', () => {
  it('maps API-missing probe result to unavailable', async () => {
    const registry = new CapabilityRegistry(
      fakeProbe({
        languageDetector: 'unavailable',
        summarizer: 'unavailable',
        translator: 'unavailable',
        prompt: 'unavailable',
      }),
    )

    await expect(registry.get('languageDetector')).resolves.toBe('unavailable')
    await expect(registry.get('summarizer')).resolves.toBe('unavailable')
    await expect(registry.get('translator', { sourceLanguage: 'en', targetLanguage: 'pt' })).resolves.toBe(
      'unavailable',
    )
    await expect(registry.get('prompt')).resolves.toBe('unavailable')
  })

  it.each([
    ['downloadable', 'downloadable'],
    ['downloading', 'downloading'],
    ['available', 'available'],
  ] as const)('exposes probe readiness %s as %s', async (probeStatus, expected) => {
    const registry = new CapabilityRegistry(
      fakeProbe({
        languageDetector: probeStatus,
        summarizer: probeStatus,
        translator: probeStatus,
        prompt: probeStatus,
      }),
    )

    await expect(registry.get('languageDetector')).resolves.toBe(expected)
    await expect(registry.get('summarizer')).resolves.toBe(expected)
    await expect(registry.get('translator', { sourceLanguage: 'en', targetLanguage: 'es' })).resolves.toBe(
      expected,
    )
    await expect(registry.get('prompt')).resolves.toBe(expected)
  })

  it('passes translator source/target pair options to the probe', async () => {
    const seen: Array<{ id: CapabilityId; options?: { sourceLanguage?: string; targetLanguage?: string } }> =
      []
    const registry = new CapabilityRegistry(
      fakeProbe({ translator: 'available' }, (id, options) => {
        seen.push({ id, options })
      }),
    )

    await registry.get('translator', { sourceLanguage: 'en', targetLanguage: 'pt' })

    expect(seen).toEqual([
      {
        id: 'translator',
        options: { sourceLanguage: 'en', targetLanguage: 'pt' },
      },
    ])
  })

  it('returns a snapshot for all known capabilities', async () => {
    const registry = new CapabilityRegistry(
      fakeProbe({
        languageDetector: 'available',
        summarizer: 'downloadable',
        translator: 'downloading',
        prompt: 'unavailable',
      }),
    )

    await expect(
      registry.snapshot({ translator: { sourceLanguage: 'en', targetLanguage: 'pt' } }),
    ).resolves.toEqual({
      languageDetector: 'available',
      summarizer: 'downloadable',
      translator: 'downloading',
      prompt: 'unavailable',
    })
  })

  it('treats probe failures as unavailable', async () => {
    const registry = new CapabilityRegistry({
      async probe() {
        throw new Error('probe exploded')
      },
    })

    await expect(registry.get('summarizer')).resolves.toBe('unavailable')
  })

  it('throws for an unknown capability id', async () => {
    const registry = new CapabilityRegistry(fakeProbe({}))

    await expect(registry.get('writer' as CapabilityId)).rejects.toBeInstanceOf(UnknownCapabilityError)
  })

  it('lists the four MVP capability ids', () => {
    expect(CAPABILITY_IDS).toEqual(['languageDetector', 'summarizer', 'translator', 'prompt'])
  })

  it('reports unavailable when Chrome AI globals are missing', async () => {
    const registry = new CapabilityRegistry(createChromeAiCapabilityProbe({}))

    await expect(registry.get('languageDetector')).resolves.toBe('unavailable')
    await expect(registry.get('summarizer')).resolves.toBe('unavailable')
    await expect(registry.get('translator', { sourceLanguage: 'en', targetLanguage: 'pt' })).resolves.toBe(
      'unavailable',
    )
    await expect(registry.get('prompt')).resolves.toBe('unavailable')
  })

  it('maps Chrome AI availability() through the registry', async () => {
    const availability = vi.fn(async () => 'available' as const)
    const registry = new CapabilityRegistry(
      createChromeAiCapabilityProbe({
        LanguageDetector: { availability },
        Summarizer: { availability: async () => 'downloadable' },
        Translator: {
          availability: async (options) => {
            expect(options).toEqual({ sourceLanguage: 'en', targetLanguage: 'pt' })
            return 'downloading'
          },
        },
        LanguageModel: { availability: async () => 'available' },
      }),
    )

    await expect(registry.get('languageDetector')).resolves.toBe('available')
    await expect(registry.get('summarizer')).resolves.toBe('downloadable')
    await expect(registry.get('translator', { sourceLanguage: 'en', targetLanguage: 'pt' })).resolves.toBe(
      'downloading',
    )
    await expect(registry.get('prompt')).resolves.toBe('available')
    expect(availability).toHaveBeenCalledOnce()
  })
})
