import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCapabilityReadiness,
  createFakeLanguageDetector,
  createFakePrompt,
  createFakeSummarizer,
  createFakeTranslator,
} from '../../adapters/chrome-ai/fakeAiAdapters'
import { createToolRegistry } from '../ToolRegistry'
import { ToolError } from '../types'
import { registerBuiltinAiTools } from './createBuiltinAiTools'

function createAvailableDeps(overrides?: {
  language?: string
  translate?: ReturnType<typeof createFakeTranslator>
  summarize?: ReturnType<typeof createFakeSummarizer>
  prompt?: ReturnType<typeof createFakePrompt>
  readiness?: ReturnType<typeof createFakeCapabilityReadiness>
}) {
  return {
    languageDetector: createFakeLanguageDetector([
      { detectedLanguage: overrides?.language ?? 'en', confidence: 0.95 },
    ]),
    translator:
      overrides?.translate ??
      createFakeTranslator((text, options) => `[${options.sourceLanguage}->${options.targetLanguage}]${text}`),
    summarizer: overrides?.summarize ?? createFakeSummarizer((text) => `SUMMARY:${text}`),
    prompt: overrides?.prompt ?? createFakePrompt((input) => `PROMPT:${input}`),
    readiness:
      overrides?.readiness ??
      createFakeCapabilityReadiness({
        languageDetector: 'available',
        summarizer: 'available',
        translator: 'available',
        prompt: 'available',
      }),
  }
}

describe('Built-in AI tools', () => {
  it('registers the four AI tools with LOCAL dataBoundary', () => {
    const registry = createToolRegistry()
    registerBuiltinAiTools(registry, createAvailableDeps())

    const names = registry.list().map((tool) => tool.name).sort()
    expect(names).toEqual(['detectLanguage', 'prompt', 'summarize', 'translate'])
    for (const tool of registry.list()) {
      expect(tool.dataBoundary).toBe('LOCAL')
    }
  })

  it('detectLanguage returns Zod-validated detections via fake adapter', async () => {
    const registry = createToolRegistry()
    registerBuiltinAiTools(
      registry,
      createAvailableDeps({
        language: 'pt',
      }),
    )

    await expect(registry.execute('detectLanguage', { text: 'Olá' })).resolves.toEqual({
      language: 'pt',
      confidence: 0.95,
      detections: [{ detectedLanguage: 'pt', confidence: 0.95 }],
    })
  })

  it('translate returns Zod-validated translation via fake adapter', async () => {
    const registry = createToolRegistry()
    registerBuiltinAiTools(registry, createAvailableDeps())

    await expect(
      registry.execute('translate', {
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'pt',
      }),
    ).resolves.toEqual({
      text: '[en->pt]Hello',
      sourceLanguage: 'en',
      targetLanguage: 'pt',
    })
  })

  it('summarize skips inbound translate when source is already FoundationLanguage', async () => {
    const translate = vi.fn(async (text: string) => text)
    const summarize = vi.fn(async (text: string) => `SUMMARY:${text}`)
    const registry = createToolRegistry()
    registerBuiltinAiTools(
      registry,
      createAvailableDeps({
        translate: createFakeTranslator(translate),
        summarize: createFakeSummarizer(summarize),
      }),
    )

    await expect(
      registry.execute('summarize', {
        text: 'Hello from English',
        sourceLanguage: 'en',
      }),
    ).resolves.toEqual({
      summary: 'SUMMARY:Hello from English',
      sourceLanguage: 'en',
      foundationLanguage: 'en',
      translatedInbound: false,
    })
    expect(translate).not.toHaveBeenCalled()
    expect(summarize).toHaveBeenCalledWith(
      'Hello from English',
      expect.objectContaining({
        outputLanguage: 'en',
        expectedInputLanguages: ['en'],
      }),
    )
  })

  it('summarize translates inbound pt before summarizing', async () => {
    const translate = vi.fn(async (_text: string, options: { sourceLanguage: string; targetLanguage: string }) => {
      expect(options).toEqual({ sourceLanguage: 'pt', targetLanguage: 'en' })
      return 'Hello world'
    })
    const summarize = vi.fn(async (text: string) => `SUMMARY:${text}`)
    const registry = createToolRegistry()
    registerBuiltinAiTools(
      registry,
      createAvailableDeps({
        language: 'pt',
        translate: createFakeTranslator(translate),
        summarize: createFakeSummarizer(summarize),
      }),
    )

    await expect(
      registry.execute('summarize', {
        text: 'Olá mundo',
        sourceLanguage: 'pt',
      }),
    ).resolves.toEqual({
      summary: 'SUMMARY:Hello world',
      sourceLanguage: 'pt',
      foundationLanguage: 'en',
      translatedInbound: true,
    })
    expect(translate).toHaveBeenCalledOnce()
    expect(summarize).toHaveBeenCalledWith(
      'Hello world',
      expect.objectContaining({
        outputLanguage: 'en',
        expectedInputLanguages: ['en'],
      }),
    )
  })

  it('prompt accepts responseConstraint and returns structured JSON', async () => {
    const responseConstraint = {
      type: 'object',
      properties: {
        concepts: { type: 'array', items: { type: 'string' } },
      },
      required: ['concepts'],
    }
    const prompt = vi.fn(async (_input: string, options?: { responseConstraint?: Record<string, unknown> }) => {
      expect(options?.responseConstraint).toEqual(responseConstraint)
      return JSON.stringify({ concepts: ['agents', 'tools'] })
    })
    const registry = createToolRegistry()
    registerBuiltinAiTools(
      registry,
      createAvailableDeps({
        prompt: createFakePrompt(prompt),
      }),
    )

    await expect(
      registry.execute('prompt', {
        text: 'Extract concepts from this English page',
        sourceLanguage: 'en',
        responseConstraint,
      }),
    ).resolves.toEqual({
      text: JSON.stringify({ concepts: ['agents', 'tools'] }),
      structured: { concepts: ['agents', 'tools'] },
      sourceLanguage: 'en',
      foundationLanguage: 'en',
      translatedInbound: false,
    })
  })

  it('prompt translates inbound pt before prompting', async () => {
    const translate = vi.fn(async () => 'Normalized English')
    const prompt = vi.fn(async (input: string) => `PROMPT:${input}`)
    const registry = createToolRegistry()
    registerBuiltinAiTools(
      registry,
      createAvailableDeps({
        translate: createFakeTranslator(translate),
        prompt: createFakePrompt(prompt),
      }),
    )

    await expect(
      registry.execute('prompt', {
        text: 'Texto em português',
        sourceLanguage: 'pt',
      }),
    ).resolves.toEqual({
      text: 'PROMPT:Normalized English',
      structured: undefined,
      sourceLanguage: 'pt',
      foundationLanguage: 'en',
      translatedInbound: true,
    })
    expect(translate).toHaveBeenCalledOnce()
  })

  it('returns an explicit capability_unavailable tool error (no silent fail)', async () => {
    const registry = createToolRegistry()
    registerBuiltinAiTools(
      registry,
      createAvailableDeps({
        readiness: createFakeCapabilityReadiness({
          languageDetector: 'unavailable',
          summarizer: 'unavailable',
          translator: 'unavailable',
          prompt: 'unavailable',
        }),
      }),
    )

    await expect(registry.execute('detectLanguage', { text: 'Hello' })).rejects.toMatchObject({
      name: 'ToolError',
      code: 'capability_unavailable',
      capabilityId: 'languageDetector',
    })

    await expect(
      registry.execute('summarize', { text: 'Hello', sourceLanguage: 'en' }),
    ).rejects.toBeInstanceOf(ToolError)

    await expect(
      registry.execute('summarize', { text: 'Hello', sourceLanguage: 'en' }),
    ).rejects.toMatchObject({
      code: 'capability_unavailable',
      capabilityId: 'summarizer',
    })
  })

  it('rejects invalid tool input before calling adapters', async () => {
    const languageDetector = createFakeLanguageDetector([])
    const detectSpy = vi.spyOn(languageDetector, 'detect')
    const registry = createToolRegistry()
    registerBuiltinAiTools(registry, {
      ...createAvailableDeps(),
      languageDetector,
    })

    await expect(registry.execute('detectLanguage', { text: '' })).rejects.toMatchObject({
      code: 'invalid_input',
    })
    expect(detectSpy).not.toHaveBeenCalled()
  })
})
