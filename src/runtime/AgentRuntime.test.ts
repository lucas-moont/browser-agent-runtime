import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { CapabilityId, CapabilityReadiness, CapabilityRegistry } from '../capabilities/CapabilityRegistry'
import { createToolRegistry } from '../tools/ToolRegistry'
import type { AgentTool } from '../tools/types'
import { createAgentRuntime } from './AgentRuntime'
import { createAllowByDefaultPolicy } from './policy'
import { createPlanner } from './Planner'

function fakeCapabilities(
  readiness: Partial<Record<CapabilityId, CapabilityReadiness>> = {},
): CapabilityRegistry {
  const snapshot = {
    languageDetector: readiness.languageDetector ?? 'available',
    summarizer: readiness.summarizer ?? 'available',
    translator: readiness.translator ?? 'available',
    prompt: readiness.prompt ?? 'available',
  }
  return {
    async get(id) {
      return snapshot[id]
    },
    async snapshot(options) {
      void options
      return snapshot
    },
  } as CapabilityRegistry
}

function registerFakeTools(
  language = 'en',
  options?: {
    concepts?: { concepts: string[]; topics: string[] }
    learningPath?: {
      prerequisites: string[]
      concepts: string[]
      sequence: string[]
      nextTopics: string[]
    }
    invalidConcepts?: boolean
  },
) {
  const registry = createToolRegistry()

  const passthrough = z.unknown()

  const extractPage: AgentTool = {
    name: 'extractPage',
    description: 'extract',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({
      title: z.string(),
      url: z.string(),
      selection: z.string(),
      mainText: z.string(),
    }),
    async execute() {
      return {
        title: 'Demo',
        url: 'https://example.com',
        selection: '',
        mainText: language === 'pt' ? 'Olá mundo da página' : 'Hello from the page',
      }
    },
  }

  const detectLanguage: AgentTool = {
    name: 'detectLanguage',
    description: 'detect',
    capabilities: ['languageDetector'],
    dataBoundary: 'LOCAL',
    inputSchema: z.strictObject({ text: z.string() }),
    outputSchema: z.strictObject({
      language: z.string(),
      confidence: z.number(),
      detections: z.array(
        z.strictObject({
          detectedLanguage: z.string(),
          confidence: z.number(),
        }),
      ),
    }),
    async execute() {
      return {
        language,
        confidence: 0.9,
        detections: [{ detectedLanguage: language, confidence: 0.9 }],
      }
    },
  }

  const summarize: AgentTool = {
    name: 'summarize',
    description: 'summarize',
    capabilities: ['summarizer'],
    dataBoundary: 'LOCAL',
    inputSchema: z.object({
      text: z.string(),
      sourceLanguage: z.string().optional(),
      outputLanguage: z.string().optional(),
    }),
    outputSchema: z.strictObject({
      summary: z.string(),
      sourceLanguage: z.string(),
      foundationLanguage: z.enum(['en', 'ja', 'es', 'de', 'fr']),
      translatedInbound: z.boolean(),
    }),
    async execute(input: { text: string; sourceLanguage?: string; outputLanguage?: string }) {
      const sourceLanguage = input.sourceLanguage ?? language
      const translatedInbound = sourceLanguage === 'pt'
      expect(input.outputLanguage).not.toBe('pt')
      const foundationLanguage =
        input.outputLanguage === 'ja' ||
        input.outputLanguage === 'es' ||
        input.outputLanguage === 'de' ||
        input.outputLanguage === 'fr' ||
        input.outputLanguage === 'en'
          ? input.outputLanguage
          : ('en' as const)
      return {
        summary: `SUMMARY(${sourceLanguage}):${input.text}`,
        sourceLanguage,
        foundationLanguage,
        translatedInbound,
      }
    },
  }

  const translate: AgentTool = {
    name: 'translate',
    description: 'translate',
    capabilities: ['translator'],
    dataBoundary: 'LOCAL',
    inputSchema: z.strictObject({
      text: z.string(),
      sourceLanguage: z.string(),
      targetLanguage: z.string(),
    }),
    outputSchema: z.strictObject({
      text: z.string(),
      sourceLanguage: z.string(),
      targetLanguage: z.string(),
    }),
    async execute(input: { text: string; sourceLanguage: string; targetLanguage: string }) {
      return {
        text: `[${input.sourceLanguage}->${input.targetLanguage}]${input.text}`,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      }
    },
  }

  const prompt: AgentTool = {
    name: 'prompt',
    description: 'prompt',
    capabilities: ['prompt'],
    dataBoundary: 'LOCAL',
    inputSchema: z.object({
      text: z.string(),
      sourceLanguage: z.string().optional(),
      responseConstraint: passthrough.optional(),
    }),
    outputSchema: z.strictObject({
      text: z.string(),
      structured: z.unknown().optional(),
      sourceLanguage: z.string(),
      foundationLanguage: z.enum(['en', 'ja', 'es', 'de', 'fr']),
      translatedInbound: z.boolean(),
    }),
    async execute(input: {
      text: string
      sourceLanguage?: string
      responseConstraint?: unknown
    }) {
      const constraint = input.responseConstraint as { required?: string[] } | undefined
      const required = constraint?.required ?? []
      if (required.includes('sequence')) {
        const structured = options?.learningPath ?? {
          prerequisites: ['HTML'],
          concepts: ['DOM'],
          sequence: ['Read page', 'Practice'],
          nextTopics: ['Events'],
        }
        return {
          text: JSON.stringify(structured),
          structured,
          sourceLanguage: input.sourceLanguage ?? language,
          foundationLanguage: 'en' as const,
          translatedInbound: language === 'pt',
        }
      }
      if (options?.invalidConcepts) {
        return {
          text: '{"concepts":"bad","topics":[]}',
          structured: { concepts: 'bad', topics: [] },
          sourceLanguage: input.sourceLanguage ?? language,
          foundationLanguage: 'en' as const,
          translatedInbound: false,
        }
      }
      const structured = options?.concepts ?? {
        concepts: ['Agent', 'Tool'],
        topics: ['Runtime', 'Planning'],
      }
      return {
        text: JSON.stringify(structured),
        structured,
        sourceLanguage: input.sourceLanguage ?? language,
        foundationLanguage: 'en' as const,
        translatedInbound: language === 'pt',
      }
    },
  }

  for (const tool of [extractPage, detectLanguage, summarize, translate, prompt]) {
    registry.register(tool)
  }
  return registry
}

describe('AgentRuntime seam', () => {
  it('emits goal_received → context_collected → plan_created → tool events → agent_completed for Analyze Page', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en'),
      now: (() => {
        let t = 0
        return () => ++t
      })(),
    })

    const state = await runtime.run({
      goal: { instruction: 'Analyze this page.' },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.events.map((event) => event.type)).toEqual([
      'goal_received',
      'context_collected',
      'plan_created',
      'tool_started',
      'tool_completed',
      'tool_started',
      'tool_completed',
      'tool_started',
      'tool_completed',
      'agent_completed',
    ])
    expect(state.result).toEqual({
      language: 'en',
      summary: 'SUMMARY(en):Hello from the page',
      topics: ['Runtime', 'Planning'],
      concepts: ['Agent', 'Tool'],
      preferredLanguage: 'en',
    })
  })

  it('completes Learning Path with structured Result', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en'),
    })

    const state = await runtime.run({
      goal: { instruction: 'Turn this page into a learning path.' },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.workflowId).toBe('learningPath')
    expect(state.result).toEqual({
      prerequisites: ['HTML'],
      concepts: ['DOM'],
      sequence: ['Read page', 'Practice'],
      nextTopics: ['Events'],
      preferredLanguage: 'en',
    })
  })

  it('runs summarizePage with preferred=pt via foundation summarize then translate', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('pt'),
    })

    const state = await runtime.run({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'pt' },
      },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.workflowId).toBe('summarizePage')
    expect(state.result).toEqual({
      language: 'pt',
      summary: '[en->pt]SUMMARY(pt):Olá mundo da página',
      foundationLanguage: 'en',
      translatedInbound: true,
      preferredLanguage: 'pt',
    })
    const translateEvent = state.events.find(
      (event) => event.type === 'tool_completed' && event.tool === 'translate',
    )
    expect(translateEvent).toBeTruthy()
  })

  it('runs summarizePage with preferred=en without outbound translate', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en'),
    })

    const state = await runtime.run({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'en' },
      },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.result).toEqual({
      language: 'en',
      summary: 'SUMMARY(en):Hello from the page',
      foundationLanguage: 'en',
      translatedInbound: false,
      preferredLanguage: 'en',
    })
    expect(
      state.events.some(
        (event) => event.type === 'tool_completed' && event.tool === 'translate',
      ),
    ).toBe(false)
  })

  it('localizes analyzePage Result strings when preferred needs outbound translation', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en'),
    })

    const state = await runtime.run({
      goal: {
        instruction: 'Analyze this page.',
        context: { preferredLanguage: 'pt' },
      },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.result).toEqual({
      language: 'en',
      summary: '[en->pt]SUMMARY(en):Hello from the page',
      topics: ['[en->pt]Runtime', '[en->pt]Planning'],
      concepts: ['[en->pt]Agent', '[en->pt]Tool'],
      preferredLanguage: 'pt',
    })
  })

  it('fails when required capability is unavailable without calling unavailable tools', async () => {
    const tools = registerFakeTools('en')
    const execute = vi.spyOn(tools, 'execute')
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities({ prompt: 'unavailable' }),
      tools,
      planner: createPlanner(),
    })

    const state = await runtime.run({
      goal: { instruction: 'Turn this page into a learning path.' },
      tabId: 1,
    })

    expect(state.status).toBe('failed')
    expect(state.events.at(-1)?.type).toBe('agent_failed')
    expect(execute.mock.calls.map((call) => call[0])).toEqual(['extractPage'])
  })

  it('fails observably when structured Result fails Zod validation', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en', { invalidConcepts: true }),
    })

    const state = await runtime.run({
      goal: { instruction: 'Analyze this page.' },
      tabId: 1,
    })

    expect(state.status).toBe('failed')
    expect(state.error).toMatch(/validation/i)
    expect(state.events.at(-1)?.type).toBe('agent_failed')
  })

  it('allows goals by default via Policy stub', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en'),
      policy: createAllowByDefaultPolicy(),
    })

    const state = await runtime.run({
      goal: { instruction: 'Analyze this page.' },
      tabId: 1,
    })
    expect(state.status).toBe('completed')
  })

  it('respects Policy deny hook before planning', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en'),
      policy: createAllowByDefaultPolicy({
        denyGoal: () => 'denied by policy',
      }),
    })

    const state = await runtime.run({
      goal: { instruction: 'Analyze this page.' },
      tabId: 1,
    })
    expect(state.status).toBe('failed')
    expect(state.error).toBe('denied by policy')
    expect(state.events.map((event) => event.type)).toEqual([
      'goal_received',
      'agent_failed',
    ])
  })

  it('rejects a concurrent second run while one is active', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const tools = registerFakeTools('en')
    const original = tools.execute.bind(tools)
    tools.execute = async (name, input, context) => {
      if (name === 'extractPage') {
        await gate
      }
      return original(name, input, context)
    }

    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools,
    })

    const first = runtime.run({
      goal: { instruction: 'Analyze this page.' },
      tabId: 1,
    })

    await expect(
      runtime.run({
        goal: { instruction: 'Analyze this page.' },
        tabId: 1,
      }),
    ).rejects.toThrow(/active run/i)

    release()
    await first
  })
})
