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
    reply?: string
    concepts?: { concepts: string[]; topics: string[] }
    learningPath?: {
      prerequisites: string[]
      concepts: string[]
      sequence: string[]
      nextTopics: string[]
    }
    /** When true, Prompt returns a non-string `reply` and empty text so Result validation fails. */
    invalidReply?: boolean
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
      if (options?.invalidReply || required.includes('reply')) {
        if (options?.invalidReply) {
          return {
            text: '',
            structured: { reply: 123 },
            sourceLanguage: input.sourceLanguage ?? language,
            foundationLanguage: 'en' as const,
            translatedInbound: false,
          }
        }
        const reply =
          options?.reply ??
          'Conversational reply about the page.'
        return {
          text: JSON.stringify({ reply }),
          structured: { reply },
          sourceLanguage: input.sourceLanguage ?? language,
          foundationLanguage: 'en' as const,
          translatedInbound: language === 'pt',
        }
      }
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
  it('emits goal_received → context_collected → plan_created → tool events → agent_completed for page suggestion text', async () => {
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
    expect(state.workflowId).toBe('conversational')
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
      reply: 'Conversational reply about the page.',
      language: 'en',
      preferredLanguage: 'en',
    })
  })

  it('completes Learning Path suggestion text as conversational reply', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en', {
        reply: 'A learning path based on this page.',
      }),
    })

    const state = await runtime.run({
      goal: { instruction: 'Turn this page into a learning path.' },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.workflowId).toBe('conversational')
    expect(state.result).toEqual({
      reply: 'A learning path based on this page.',
      language: 'en',
      preferredLanguage: 'en',
    })
  })

  it('runs Summarize suggestion with preferred=pt via conversational plan then outbound localize', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('pt', {
        reply: 'SUMMARY reply',
      }),
    })

    const state = await runtime.run({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'pt' },
      },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.workflowId).toBe('conversational')
    expect(state.result).toEqual({
      reply: '[en->pt]SUMMARY reply',
      language: 'pt',
      preferredLanguage: 'pt',
    })
  })

  it('runs Summarize suggestion with preferred=en without outbound translate', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en', {
        reply: 'SUMMARY(en):Hello from the page',
      }),
    })

    const state = await runtime.run({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'en' },
      },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.workflowId).toBe('conversational')
    expect(state.result).toEqual({
      reply: 'SUMMARY(en):Hello from the page',
      language: 'en',
      preferredLanguage: 'en',
    })
    expect(
      state.events.some(
        (event) => event.type === 'tool_completed' && event.tool === 'translate',
      ),
    ).toBe(false)
  })

  it('localizes conversational reply when preferred needs outbound translation', async () => {
    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registerFakeTools('en', {
        reply: 'Hello from the page',
      }),
    })

    const state = await runtime.run({
      goal: {
        instruction: 'Analyze this page.',
        context: { preferredLanguage: 'pt' },
      },
      tabId: 1,
    })

    expect(state.status).toBe('completed')
    expect(state.workflowId).toBe('conversational')
    expect(state.result).toEqual({
      reply: '[en->pt]Hello from the page',
      language: 'en',
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
      tools: registerFakeTools('en', { invalidReply: true }),
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

  it('fails research runs when SERP mainText is empty', async () => {
    const registry = createToolRegistry()
    const base = registerFakeTools('en')
    for (const tool of base.list()) {
      registry.register(tool)
    }
    registry.register({
      name: 'searchWeb',
      description: 'search',
      capabilities: [],
      dataBoundary: 'BROWSER',
      inputSchema: z.object({
        query: z.string().optional(),
        fallbackQuery: z.string().optional(),
      }),
      outputSchema: z.object({
        query: z.string(),
        url: z.string(),
        mainText: z.string(),
        results: z.array(
          z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
          }),
        ),
        mode: z.enum(['fetch', 'tab']),
        tabId: z.number().optional(),
      }),
      async execute(input: { query?: string; fallbackQuery?: string }) {
        return {
          query: input.query?.trim() || input.fallbackQuery || 'x',
          url: 'https://html.duckduckgo.com/html/?q=x',
          mainText: '',
          results: [],
          mode: 'fetch' as const,
        }
      },
    })

    const runtime = createAgentRuntime({
      capabilities: fakeCapabilities(),
      tools: registry,
    })

    const state = await runtime.run({
      goal: { instruction: 'Search the web for agent runtimes' },
      tabId: 1,
      groupId: 1,
    })

    expect(state.status).toBe('failed')
    expect(state.error).toMatch(/empty or blocked/i)
    expect(state.events.some((event) => event.type === 'agent_failed')).toBe(true)
  })
})
