import { describe, expect, it } from 'vitest'
import { createPlanner } from './Planner'
import type { CapabilitySnapshotLike, ToolCatalogEntry } from './types'

const FULL_CATALOG: ToolCatalogEntry[] = [
  { name: 'extractPage', description: 'extract', capabilities: [] },
  { name: 'detectLanguage', description: 'detect', capabilities: ['languageDetector'] },
  { name: 'summarize', description: 'summarize', capabilities: ['summarizer'] },
  { name: 'translate', description: 'translate', capabilities: ['translator'] },
  { name: 'prompt', description: 'prompt', capabilities: ['prompt'] },
]

const ALL_AVAILABLE: CapabilitySnapshotLike = {
  languageDetector: 'available',
  summarizer: 'available',
  translator: 'available',
  prompt: 'available',
}

describe('Planner seam', () => {
  it('treats Analyze Page suggestion text as conversational page-grounded plan', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Analyze this page.' },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.workflowId).toBe('conversational')
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'prompt',
    ])
    expect(result.plan.steps.map((step) => step.id)).toEqual(['detect', 'summarize', 'reply'])
    expect(result.plan.steps[2]?.input).toMatchObject({
      responseConstraint: expect.objectContaining({
        required: expect.arrayContaining(['reply']),
      }),
    })
  })

  it('treats Learning Path suggestion text as conversational page-grounded plan', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Turn this page into a learning path.' },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.workflowId).toBe('conversational')
    expect(result.plan.steps.map((step) => `${step.id}:${step.tool}`)).toEqual([
      'detect:detectLanguage',
      'summarize:summarize',
      'reply:prompt',
    ])
  })

  it('plans Summarize suggestion with preferred=pt as conversational (outbound localize later)', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'pt' },
      },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.workflowId).toBe('conversational')
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'prompt',
    ])
    const summarizeInput = result.plan.steps[1]?.input as Record<string, unknown>
    expect(summarizeInput).toMatchObject({ outputLanguage: 'en' })
    expect(summarizeInput).not.toMatchObject({ outputLanguage: 'pt' })
  })

  it('plans Summarize suggestion with preferred=en without translate step in the plan', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'en' },
      },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.workflowId).toBe('conversational')
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'prompt',
    ])
    expect(result.plan.steps[1]?.input).toMatchObject({ outputLanguage: 'en' })
  })

  it('plans Summarize suggestion with preferred ja using summarize outputLanguage', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: {
        instruction: 'Summarize this page.',
        context: { preferredLanguage: 'ja' },
      },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'prompt',
    ])
    expect(result.plan.steps[1]?.input).toMatchObject({ outputLanguage: 'ja' })
  })

  it('cannot plan page-grounded suggestion text when Prompt is unavailable', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Analyze this page and list key concepts.' },
      capabilities: {
        ...ALL_AVAILABLE,
        prompt: 'unavailable',
      },
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.reason).toMatch(/Prompt/i)
  })

  it('cannot plan Learning Path suggestion when Prompt capability is unavailable', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Turn this page into a learning path.' },
      capabilities: {
        ...ALL_AVAILABLE,
        prompt: 'unavailable',
      },
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.reason).toMatch(/Prompt/i)
    expect(result.missingCapabilities).toContain('prompt')
  })

  it('never emits Writer/Rewriter/Proofreader steps for suggestion messages', () => {
    const planner = createPlanner()
    const tools: ToolCatalogEntry[] = [
      ...FULL_CATALOG,
      { name: 'writer', description: 'writer', capabilities: [] },
      { name: 'rewriter', description: 'rewriter', capabilities: [] },
      { name: 'proofreader', description: 'proofreader', capabilities: [] },
    ]

    for (const instruction of [
      'Analyze this page.',
      'Turn this page into a learning path.',
      'Summarize this page.',
    ]) {
      const result = planner.plan({
        goal: { instruction },
        capabilities: ALL_AVAILABLE,
        tools,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) {
        continue
      }
      expect(result.plan.workflowId).toBe('conversational')
      const names = result.plan.steps.map((step) => step.tool.toLowerCase())
      expect(names).not.toContain('writer')
      expect(names).not.toContain('rewriter')
      expect(names).not.toContain('proofreader')
    }
  })

  it('plans free-form goals as conversational detect → summarize → prompt reply', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: {
        instruction: 'What are the three main risks called out on this page?',
        context: {
          preferredLanguage: 'en',
          conversationHistory: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello — how can I help with this page?' },
          ],
        },
      },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.workflowId).toBe('conversational')
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'prompt',
    ])
    const promptInput = result.plan.steps[2]?.input as {
      text: { $concat: unknown[] }
      responseConstraint: { required: string[] }
    }
    expect(promptInput.responseConstraint.required).toContain('reply')
    expect(JSON.stringify(promptInput.text.$concat)).toContain('three main risks')
    expect(JSON.stringify(promptInput.text.$concat)).toContain('Prior conversation')
    expect(JSON.stringify(promptInput.text.$concat)).toContain('actually help')
    expect(JSON.stringify(promptInput.text.$concat)).toContain('Page notes')
  })

  it('plans web-search asks as searchWeb → extract → reply with raw truncated SERP text', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Can you search the internet for orchestrator memory?' },
      capabilities: ALL_AVAILABLE,
      tools: [...FULL_CATALOG, { name: 'searchWeb', description: 'search', capabilities: [] }],
      pageContext: { title: 'Orchestrator memory' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'searchWeb',
      'extractPage',
      'detectLanguage',
      'prompt',
    ])
    const searchInput = result.plan.steps[0]?.input as { query: string }
    expect(searchInput.query).toContain('orchestrator memory')
    const reply = result.plan.steps.find((step) => step.id === 'reply')?.input as {
      text: { $concat: unknown[] }
    }
    expect(JSON.stringify(reply.text.$concat)).toContain('$truncate')
    expect(JSON.stringify(reply.text.$concat)).toContain('extractSearch.mainText')
  })

  it('plans deep follow-ups as research using the page title in the query', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: {
        instruction:
          'You can think for yourself. Bring me the most interesting ones that correlate and will make my knowledge of the subject go in depth.',
      },
      capabilities: ALL_AVAILABLE,
      tools: [...FULL_CATALOG, { name: 'searchWeb', description: 'search', capabilities: [] }],
      pageContext: { title: 'Subagents and orchestrator memory' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.steps[0]?.tool).toBe('searchWeb')
    const searchInput = result.plan.steps[0]?.input as { query: string }
    expect(searchInput.query).toContain('Subagents and orchestrator memory')
  })

  it('keeps general chat free of page summarize steps', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'What do you think about typed agent runtimes?' },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.steps.map((step) => step.tool)).toEqual(['detectLanguage', 'prompt'])
    const promptInput = result.plan.steps.find((step) => step.id === 'reply')?.input as {
      text: { $concat: unknown[] }
    }
    const blob = JSON.stringify(promptInput.text.$concat)
    expect(blob).toContain('What do you think about typed agent runtimes?')
    expect(blob).toContain('No page extract is included')
    expect(blob).toContain('Do not')
  })

  it('cannot plan free-form conversation when Prompt is unavailable', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Explain this like I am five' },
      capabilities: {
        ...ALL_AVAILABLE,
        prompt: 'unavailable',
      },
      tools: FULL_CATALOG,
    })
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.reason).toMatch(/Prompt/i)
  })

  it('does not execute tools (planner is pure)', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Analyze this page.' },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })
    expect(result.ok).toBe(true)
    expect(typeof planner.plan).toBe('function')
  })
})
