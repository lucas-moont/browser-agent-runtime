import { describe, expect, it, vi } from 'vitest'
import { createChromeAiCapabilityProbe } from '../adapters/chrome-ai/createChromeAiCapabilityProbe'
import {
  CAPABILITY_IDS,
  CapabilityRegistry,
  UnknownCapabilityError,
  type CapabilityId,
  type CapabilityProbe,
  type CapabilityProbeOptions,
  type CapabilityReadiness,
} from './CapabilityRegistry'

function fakeProbe(
  responses: Partial<Record<CapabilityId, CapabilityReadiness>>,
  onProbe?: (id: CapabilityId, options?: CapabilityProbeOptions) => void,
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
    const summarizerAvailability = vi.fn(async (options?: Record<string, unknown>) => {
      expect(options).toEqual({
        outputLanguage: 'en',
        expectedInputLanguages: ['en'],
        expectedContextLanguages: ['en'],
      })
      return 'downloadable' as const
    })
    const promptAvailability = vi.fn(async (options?: Record<string, unknown>) => {
      expect(options).toEqual({
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      })
      return 'available' as const
    })
    const registry = new CapabilityRegistry(
      createChromeAiCapabilityProbe({
        LanguageDetector: { availability },
        Summarizer: { availability: summarizerAvailability },
        Translator: {
          availability: async (options) => {
            expect(options).toEqual({ sourceLanguage: 'en', targetLanguage: 'pt' })
            return 'downloading'
          },
        },
        LanguageModel: { availability: promptAvailability },
      }),
    )

    await expect(registry.get('languageDetector')).resolves.toBe('available')
    await expect(registry.get('summarizer', { outputLanguage: 'en' })).resolves.toBe('downloadable')
    await expect(registry.get('translator', { sourceLanguage: 'en', targetLanguage: 'pt' })).resolves.toBe(
      'downloading',
    )
    await expect(registry.get('prompt', { outputLanguage: 'en' })).resolves.toBe('available')
    expect(availability).toHaveBeenCalledOnce()
    expect(summarizerAvailability).toHaveBeenCalledOnce()
    expect(promptAvailability).toHaveBeenCalledOnce()
  })

  it('passes outputLanguage to summarizer and prompt probes in snapshot', async () => {
    const seen: Array<{ id: CapabilityId; options?: CapabilityProbeOptions }> = []
    const registry = new CapabilityRegistry(
      fakeProbe(
        {
          languageDetector: 'available',
          summarizer: 'available',
          translator: 'available',
          prompt: 'available',
        },
        (id, options) => {
          seen.push({ id, options })
        },
      ),
    )

    await registry.snapshot({
      outputLanguage: 'en',
      translator: { sourceLanguage: 'en', targetLanguage: 'pt' },
    })

    expect(seen).toEqual(
      expect.arrayContaining([
        { id: 'summarizer', options: { outputLanguage: 'en' } },
        { id: 'prompt', options: { outputLanguage: 'en' } },
        { id: 'translator', options: { sourceLanguage: 'en', targetLanguage: 'pt' } },
      ]),
    )
  })
})
