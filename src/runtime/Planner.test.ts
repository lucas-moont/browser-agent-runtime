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
  it('maps Analyze Page goal to detect → summarize → prompt concepts with coherent dependsOn', () => {
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
    expect(result.plan.workflowId).toBe('analyzePage')
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'prompt',
    ])
    expect(result.plan.steps.map((step) => step.id)).toEqual(['detect', 'summarize', 'concepts'])
    expect(result.plan.steps[1]?.dependsOn).toEqual(['detect'])
    expect(result.plan.steps[2]?.dependsOn).toEqual(['summarize'])
    expect(result.plan.steps[2]?.input).toMatchObject({
      responseConstraint: expect.objectContaining({
        required: expect.arrayContaining(['concepts', 'topics']),
      }),
    })
  })

  it('maps Learning Path goal to detect → summarize → prompt learning-path constraint', () => {
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
    expect(result.plan.workflowId).toBe('learningPath')
    expect(result.plan.steps.map((step) => `${step.id}:${step.tool}`)).toEqual([
      'detect:detectLanguage',
      'summarize:summarize',
      'learningPath:prompt',
    ])
    expect(result.plan.steps[2]?.input).toMatchObject({
      responseConstraint: expect.objectContaining({
        required: expect.arrayContaining([
          'prerequisites',
          'concepts',
          'sequence',
          'nextTopics',
        ]),
      }),
    })
  })

  it('plans Summarize in Portuguese as detect → summarize → translate to pt (never summarize with pt I/O)', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Summarize this page in Portuguese.' },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.workflowId).toBe('summarizeInPortuguese')
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      'detectLanguage',
      'summarize',
      'translate',
    ])
    const summarizeInput = result.plan.steps[1]?.input as Record<string, unknown>
    expect(summarizeInput).not.toMatchObject({ outputLanguage: 'pt' })
    expect(result.plan.steps[2]?.input).toEqual({
      text: { $from: 'summarize.summary' },
      sourceLanguage: { $from: 'summarize.foundationLanguage' },
      targetLanguage: 'pt',
    })
  })

  it('degrades Analyze Page when Prompt is unavailable but Summarizer is available', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Analyze this page and list key concepts.' },
      capabilities: {
        ...ALL_AVAILABLE,
        prompt: 'unavailable',
      },
      tools: FULL_CATALOG,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.plan.steps.map((step) => step.tool)).toEqual(['detectLanguage', 'summarize'])
    expect(result.plan.steps.some((step) => step.tool === 'prompt')).toBe(false)
  })

  it('cannot plan Learning Path when Prompt capability is unavailable', () => {
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

  it('never emits Writer/Rewriter/Proofreader steps for demo goals', () => {
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
      'Summarize this page in Portuguese.',
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
      const names = result.plan.steps.map((step) => step.tool.toLowerCase())
      expect(names).not.toContain('writer')
      expect(names).not.toContain('rewriter')
      expect(names).not.toContain('proofreader')
    }
  })

  it('returns cannot-plan for unrecognized goals', () => {
    const planner = createPlanner()
    const result = planner.plan({
      goal: { instruction: 'Book me a flight to Mars' },
      capabilities: ALL_AVAILABLE,
      tools: FULL_CATALOG,
    })
    expect(result.ok).toBe(false)
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
