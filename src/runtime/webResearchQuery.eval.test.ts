import { describe, expect, it } from 'vitest'
import { buildWebResearchQuery } from './Planner'
import {
  assertGoodSearchQuery,
  evaluateSearchQueryQuality,
  MAX_SEARCH_QUERY_CHARS,
} from './webResearchQueryQuality'

/**
 * Free deterministic research-query evals for CI.
 * DeepEval/Ragas need external LLM judges — intentionally not used here.
 */
describe('web research query evals', () => {
  it('Orchestrator Tax similar-articles ask does not leak user prose into the seed query', () => {
    const instruction =
      'Search the web for similar articles like this one. The goal is to improve my knowledge into the subject.'
    const query = buildWebResearchQuery(instruction, { title: "The Orchestrator's Tax" })

    assertGoodSearchQuery(query, {
      mustInclude: ['Orchestrator', 'Tax'],
      mustNotInclude: [
        'improve my knowledge',
        'similar articles like this one',
        'the goal is',
        'search the web',
      ],
      maxChars: MAX_SEARCH_QUERY_CHARS,
    })
  })

  it('plain topical search strips the search-prefix and stays concise', () => {
    const query = buildWebResearchQuery('Can you search the internet for orchestrator memory?', {
      title: 'Unrelated page',
    })
    assertGoodSearchQuery(query, {
      mustInclude: ['orchestrator', 'memory'],
      mustNotInclude: ['search the internet', 'can you'],
    })
  })

  it('deep follow-up keeps the page title and drops instructional filler', () => {
    const query = buildWebResearchQuery(
      'Bring me the most interesting ones that correlate and will make my knowledge of the subject go in depth.',
      { title: 'Subagents and orchestrator memory' },
    )
    assertGoodSearchQuery(query, {
      mustInclude: ['Subagents', 'orchestrator'],
      mustNotInclude: ['most interesting', 'my knowledge', 'in depth'],
    })
  })

  it('evaluateSearchQueryQuality reports empty and overlong queries', () => {
    expect(evaluateSearchQueryQuality('').map((issue) => issue.code)).toContain('empty')
    expect(
      evaluateSearchQueryQuality('x'.repeat(MAX_SEARCH_QUERY_CHARS + 1)).map((issue) => issue.code),
    ).toContain('too_long')
  })
})
