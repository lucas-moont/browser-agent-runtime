import {
  compactSearchQuery,
  stripInstructionalSearchProse,
  topicExtrasFromInstruction,
} from './webResearchQueryQuality'
import { formatConversationHistory, resolveWorkflowId } from './demoGoals'
import {
  needsOutboundTranslation,
  parsePreferredLanguage,
  workingFoundationLanguage,
  type PreferredLanguage,
} from './preferredLanguage'
import type {
  AgentStep,
  CapabilitySnapshotLike,
  Goal,
  PlanResult,
  ToolCatalogEntry,
  WorkflowId,
} from './types'

export type PlannerInput = {
  goal: Goal
  capabilities: CapabilitySnapshotLike
  tools: ToolCatalogEntry[]
  pageContext?: unknown
}

const CONCEPTS_CONSTRAINT = {
  type: 'object',
  properties: {
    concepts: { type: 'array', items: { type: 'string' } },
    topics: { type: 'array', items: { type: 'string' } },
  },
  required: ['concepts', 'topics'],
  additionalProperties: false,
} as const

const LEARNING_PATH_CONSTRAINT = {
  type: 'object',
  properties: {
    prerequisites: { type: 'array', items: { type: 'string' } },
    concepts: { type: 'array', items: { type: 'string' } },
    sequence: { type: 'array', items: { type: 'string' } },
    nextTopics: { type: 'array', items: { type: 'string' } },
  },
  required: ['prerequisites', 'concepts', 'sequence', 'nextTopics'],
  additionalProperties: false,
} as const

const REPLY_CONSTRAINT = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
  },
  required: ['reply'],
  additionalProperties: false,
} as const

const QUERY_CONSTRAINT = {
  type: 'object',
  properties: {
    query: { type: 'string' },
  },
  required: ['query'],
  additionalProperties: false,
} as const

export const WEB_RESEARCH_QUERY_REWRITE_INSTRUCTIONS = `You write web search queries for DuckDuckGo/Google.

Return JSON with a single string field "query".

Rules for "query":
- Concise keyword / noun-phrase query only (about 3–12 words).
- Prefer the page title entities and topic terms.
- Do NOT copy the user's full request.
- Do NOT include instructional prose such as "search the web", "similar articles like this one", "improve my knowledge", "the goal is", "please", or "can you".
- No trailing punctuation.
- English keywords are fine even if the user wrote in another language.`

/** System instructions for free-form Prompt replies (kept explicit for Planner tests). */
export const CONVERSATIONAL_REPLY_INSTRUCTIONS = `You are Browser Agent Runtime — an on-device assistant (Chrome Built-in AI Prompt API / Gemini Nano) in a side panel.

Mission: actually help. Deliver the user's ask. Be specific, concrete, and useful.

Do:
- Answer the request directly in the first sentences.
- Prefer concrete artifacts: claims, trade-offs, steps, named sources/titles/URLs when the prompt includes them.
- Use page or search text only as evidence — quote or cite specifics from it when relevant.
- Match the user's language. Stay concise.
- Use light Markdown when it helps reading: short paragraphs, numbered or bulleted lists, **bold** for key terms. The UI renders Markdown.
- Prefer real line breaks / Markdown lists — never HTML tags such as br, /br, or b elements.

Do not:
- Open with filler ("Great question!", "You're right to…", "That's insightful…").
- End by offering to discuss instead of delivering ("Would you like to brainstorm…?").
- Invent articles, URLs, or that you browsed beyond text included in this prompt.
- Paraphrase the whole page when the user asked for judgment, depth, or a shortlist.
- Dump raw Markdown that is hard to scan (huge headings, nested code fences for plain prose).
- Emit HTML markup in the reply string.

If evidence in the prompt is thin, say what is missing in one line, then give the best concrete help you can with what you have.`

export function looksLikeWebSearchRequest(instruction: string): boolean {
  const normalized = instruction.trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return (
    (/\b(search|google|pesquis|busca)\b/.test(normalized) &&
      /\b(web|internet|online|google|net|rede)\b/.test(normalized)) ||
    /^(search|google|pesquis[ae]|busca)\b/.test(normalized) ||
    /\b(more articles|artigos (parecidos|relacionados)|like this)\b/.test(normalized)
  )
}

export function looksLikeDeepResearchRequest(instruction: string): boolean {
  const normalized = instruction.trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return /\b(most interesting|correlate|in depth|go (in )?depth|deepen|related (papers|articles|reading)|aprofund|correlacion|mais interessantes|em profundidade)\b/.test(
    normalized,
  )
}

export function looksLikePageGroundedRequest(instruction: string): boolean {
  const normalized = instruction.trim().toLowerCase()
  if (!normalized) {
    return false
  }
  return /\b(this (page|article|doc|post|text)|the page|on this page|esta página|neste artigo|acima|this tab|summarize|resumo|analyze this|analis[ae] (esta|isso)|learning path|study path)\b/.test(
    normalized,
  )
}

export function extractWebSearchQuery(instruction: string): string {
  const trimmed = instruction.trim()
  const stripped = trimmed
    .replace(/^(can you |could you |please |você (pode|poderia) |pode |por favor )+/i, '')
    .replace(
      /^(search (the )?(web|internet|online) (for (me )?)?(about )?|google |look up (online )?|find online |pesquis(ar|e) (na (web|internet) )?(por |sobre )?|busca(r)? (na (web|internet) )?(por |sobre )?)/i,
      '',
    )
    .replace(/\?+$/, '')
    .trim()
  return stripped || trimmed
}

function pageTitleFromContext(pageContext: unknown): string {
  if (pageContext !== null && typeof pageContext === 'object' && !Array.isArray(pageContext)) {
    const title = (pageContext as { title?: unknown }).title
    if (typeof title === 'string' && title.trim()) {
      return title.trim()
    }
  }
  return ''
}

export function buildWebResearchQuery(instruction: string, pageContext: unknown): string {
  const title = pageTitleFromContext(pageContext)
  const cleaned = stripInstructionalSearchProse(extractWebSearchQuery(instruction))
  const pageLike =
    Boolean(title) &&
    (/\blike this\b/i.test(instruction) ||
      looksLikeDeepResearchRequest(instruction) ||
      /\bmore articles\b/i.test(instruction) ||
      /\bsimilar articles\b/i.test(instruction))

  if (pageLike && title) {
    const extras = topicExtrasFromInstruction(instruction, title)
    return compactSearchQuery([title, extras, 'related articles'])
  }

  if (cleaned) {
    return compactSearchQuery([cleaned])
  }

  if (title) {
    return compactSearchQuery([title, 'related articles'])
  }

  return compactSearchQuery([extractWebSearchQuery(instruction)])
}

function preferredFromGoal(goal: Goal): PreferredLanguage {
  return parsePreferredLanguage(goal.context?.preferredLanguage)
}

function isUsable(readiness: string | undefined): boolean {
  return readiness === 'available'
}

function hasTool(tools: ToolCatalogEntry[], name: string): boolean {
  return tools.some((tool) => tool.name === name)
}

function missingCapability(
  capabilities: CapabilitySnapshotLike,
  id: string,
): string | null {
  if (!isUsable(capabilities[id])) {
    return id
  }
  return null
}

function requireTools(
  tools: ToolCatalogEntry[],
  names: string[],
): string | null {
  for (const name of names) {
    if (!hasTool(tools, name)) {
      return `Missing tool in catalog: ${name}`
    }
  }
  return null
}

function buildAnalyzePagePlan(
  includePrompt: boolean,
  preferred: PreferredLanguage,
): PlanResult {
  const workingFoundation = workingFoundationLanguage(preferred)
  const steps: AgentStep[] = [
    {
      id: 'detect',
      tool: 'detectLanguage',
      input: { text: { $from: 'context.mainText' } },
    },
    {
      id: 'summarize',
      tool: 'summarize',
      input: {
        text: { $from: 'context.mainText' },
        sourceLanguage: { $from: 'detect.language' },
        outputLanguage: workingFoundation,
      },
      dependsOn: ['detect'],
    },
  ]

  if (includePrompt) {
    steps.push({
      id: 'concepts',
      tool: 'prompt',
      input: {
        text: { $from: 'context.mainText' },
        sourceLanguage: { $from: 'detect.language' },
        responseConstraint: CONCEPTS_CONSTRAINT,
      },
      dependsOn: ['summarize'],
    })
  }

  return {
    ok: true,
    plan: {
      workflowId: 'analyzePage',
      steps,
    },
  }
}

function buildLearningPathPlan(preferred: PreferredLanguage): PlanResult {
  const workingFoundation = workingFoundationLanguage(preferred)
  return {
    ok: true,
    plan: {
      workflowId: 'learningPath',
      steps: [
        {
          id: 'detect',
          tool: 'detectLanguage',
          input: { text: { $from: 'context.mainText' } },
        },
        {
          id: 'summarize',
          tool: 'summarize',
          input: {
            text: { $from: 'context.mainText' },
            sourceLanguage: { $from: 'detect.language' },
            outputLanguage: workingFoundation,
          },
          dependsOn: ['detect'],
        },
        {
          id: 'learningPath',
          tool: 'prompt',
          input: {
            text: { $from: 'context.mainText' },
            sourceLanguage: { $from: 'detect.language' },
            responseConstraint: LEARNING_PATH_CONSTRAINT,
          },
          dependsOn: ['summarize'],
        },
      ],
    },
  }
}

function buildSummarizePagePlan(preferred: PreferredLanguage): PlanResult {
  const workingFoundation = workingFoundationLanguage(preferred)
  const outbound = needsOutboundTranslation(preferred)

  const steps: AgentStep[] = [
    {
      id: 'detect',
      tool: 'detectLanguage',
      input: { text: { $from: 'context.mainText' } },
    },
    {
      id: 'summarize',
      tool: 'summarize',
      input: {
        text: { $from: 'context.mainText' },
        sourceLanguage: { $from: 'detect.language' },
        outputLanguage: workingFoundation,
      },
      dependsOn: ['detect'],
    },
  ]

  if (outbound) {
    steps.push({
      id: 'translateResult',
      tool: 'translate',
      input: {
        text: { $from: 'summarize.summary' },
        sourceLanguage: { $from: 'summarize.foundationLanguage' },
        targetLanguage: preferred,
      },
      dependsOn: ['summarize'],
    })
  }

  return {
    ok: true,
    plan: {
      workflowId: 'summarizePage',
      steps,
    },
  }
}

function buildConversationalPlan(
  preferred: PreferredLanguage,
  goal: Goal,
  tools: ToolCatalogEntry[],
  pageContext: unknown,
): PlanResult {
  const history = formatConversationHistory(goal.context?.conversationHistory)
  const instruction = goal.instruction.trim()
  const canSearch = hasTool(tools, 'searchWeb')
  const wantsResearch =
    canSearch &&
    (looksLikeWebSearchRequest(instruction) || looksLikeDeepResearchRequest(instruction))
  const pageGrounded = looksLikePageGroundedRequest(instruction)
  const searchQuerySeed = buildWebResearchQuery(instruction, pageContext)
  const pageTitle = pageTitleFromContext(pageContext)

  const steps: AgentStep[] = []

  if (wantsResearch) {
    steps.push({
      id: 'rewriteQuery',
      tool: 'prompt',
      input: {
        responseConstraint: QUERY_CONSTRAINT,
        text: `${WEB_RESEARCH_QUERY_REWRITE_INSTRUCTIONS}

Page title:
${pageTitle || '(none)'}

User request:
${instruction}

Suggested seed (use if helpful, improve if needed):
${searchQuerySeed}

Return JSON with a single string field "query".`,
      },
    })
    steps.push({
      id: 'search',
      tool: 'searchWeb',
      input: {
        query: { $from: 'rewriteQuery.structured.query' },
        fallbackQuery: searchQuerySeed,
      },
      dependsOn: ['rewriteQuery'],
    })
    steps.push({
      id: 'detect',
      tool: 'detectLanguage',
      input: { text: { $from: 'search.mainText' } },
      dependsOn: ['search'],
    })
    steps.push({
      id: 'reply',
      tool: 'prompt',
      input: {
        sourceLanguage: { $from: 'detect.language' },
        responseConstraint: REPLY_CONSTRAINT,
        text: {
          $concat: [
            `${CONVERSATIONAL_REPLY_INSTRUCTIONS}\n\nThe user wants research depth. Search results were gathered in the background (no required SERP tab). Ground the reply STRICTLY in the raw results text below — do not invent sites, URLs, or citations that are not present in that text. Prefer a shortlist of the most relevant titles/snippets with why each deepens the topic. If the SERP text is thin, say only what the extract supports.\n\nUser request:\n${instruction}\n\nSearch query seed:\n${searchQuerySeed}\n\nPrior conversation:\n${history}\n\nSearch results text:\n`,
            { $truncate: { $from: 'search.mainText' }, maxChars: 12_000 },
            '\n\nReturn JSON with a single string field "reply" containing your answer.',
          ],
        },
      },
      dependsOn: ['detect'],
    })
  } else if (pageGrounded) {
    const workingFoundation = workingFoundationLanguage(preferred)
    steps.push(
      {
        id: 'detect',
        tool: 'detectLanguage',
        input: { text: { $from: 'context.mainText' } },
      },
      {
        id: 'summarize',
        tool: 'summarize',
        input: {
          text: { $from: 'context.mainText' },
          sourceLanguage: { $from: 'detect.language' },
          outputLanguage: workingFoundation,
          type: 'key-points',
          length: 'long',
        },
        dependsOn: ['detect'],
      },
      {
        id: 'reply',
        tool: 'prompt',
        input: {
          sourceLanguage: { $from: 'detect.language' },
          responseConstraint: REPLY_CONSTRAINT,
          text: {
            $concat: [
              `${CONVERSATIONAL_REPLY_INSTRUCTIONS}\n\nThe user is asking about the current Agent Workspace page(s). Use the page notes as evidence.\n\nUser request:\n${instruction}\n\nPrior conversation:\n${history}\n\nPage notes:\n`,
              { $from: 'summarize.summary' },
              '\n\nReturn JSON with a single string field "reply" containing your answer.',
            ],
          },
        },
        dependsOn: ['summarize'],
      },
    )
  } else {
    steps.push(
      {
        id: 'detect',
        tool: 'detectLanguage',
        input: { text: instruction },
      },
      {
        id: 'reply',
        tool: 'prompt',
        input: {
          sourceLanguage: { $from: 'detect.language' },
          responseConstraint: REPLY_CONSTRAINT,
          text: {
            $concat: [
              `${CONVERSATIONAL_REPLY_INSTRUCTIONS}\n\nNo page extract is included on purpose — answer from the user request and prior conversation with your own reasoning.\n\nUser request:\n${instruction}\n\nPrior conversation:\n${history}\n`,
              '\nReturn JSON with a single string field "reply" containing your answer.',
            ],
          },
        },
        dependsOn: ['detect'],
      },
    )
  }

  return {
    ok: true,
    plan: {
      workflowId: 'conversational',
      steps,
    },
  }
}

function planWorkflow(
  workflowId: WorkflowId,
  capabilities: CapabilitySnapshotLike,
  tools: ToolCatalogEntry[],
  preferred: PreferredLanguage,
  goal: Goal,
  pageContext: unknown,
): PlanResult {
  const instruction = goal.instruction
  const researchIntent =
    looksLikeWebSearchRequest(instruction) || looksLikeDeepResearchRequest(instruction)

  const baseMissing = [
    missingCapability(capabilities, 'languageDetector'),
  ].filter((id): id is string => id !== null)

  const needsSummarizerCapability =
    workflowId !== 'conversational' ||
    (looksLikePageGroundedRequest(instruction) && !researchIntent)

  if (needsSummarizerCapability) {
    const summarizerMissing = missingCapability(capabilities, 'summarizer')
    if (summarizerMissing) {
      baseMissing.push(summarizerMissing)
    }
  }

  const needsTranslator =
    needsOutboundTranslation(preferred) &&
    (workflowId === 'summarizePage' ||
      workflowId === 'analyzePage' ||
      workflowId === 'learningPath' ||
      workflowId === 'conversational')

  if (needsTranslator) {
    const translatorMissing = missingCapability(capabilities, 'translator')
    if (translatorMissing) {
      baseMissing.push(translatorMissing)
    }
  }

  if (workflowId === 'learningPath' || workflowId === 'conversational') {
    const promptMissing = missingCapability(capabilities, 'prompt')
    if (promptMissing) {
      return {
        ok: false,
        reason:
          workflowId === 'conversational'
            ? 'Free-form conversation requires the Prompt capability'
            : 'Learning Path requires the Prompt capability',
        missingCapabilities: [promptMissing, ...baseMissing],
      }
    }
  }

  if (baseMissing.length > 0) {
    return {
      ok: false,
      reason: `Missing required capabilities: ${baseMissing.join(', ')}`,
      missingCapabilities: baseMissing,
    }
  }

  if (workflowId === 'conversational') {
    const required = ['detectLanguage', 'prompt']
    if (researchIntent && hasTool(tools, 'searchWeb')) {
      required.push('searchWeb')
    } else if (looksLikePageGroundedRequest(instruction)) {
      required.push('summarize')
    }
    if (needsOutboundTranslation(preferred)) {
      required.push('translate')
    }
    const toolError = requireTools(tools, required)
    if (toolError) {
      return { ok: false, reason: toolError }
    }
    return buildConversationalPlan(preferred, goal, tools, pageContext)
  }

  if (workflowId === 'analyzePage') {
    const toolError = requireTools(tools, ['detectLanguage', 'summarize'])
    if (toolError) {
      return { ok: false, reason: toolError }
    }
    if (needsOutboundTranslation(preferred)) {
      const translateTools = requireTools(tools, ['translate'])
      if (translateTools) {
        return { ok: false, reason: translateTools }
      }
    }
    const includePrompt =
      isUsable(capabilities.prompt) && hasTool(tools, 'prompt')
    if (includePrompt) {
      const promptTools = requireTools(tools, ['prompt'])
      if (promptTools) {
        return { ok: false, reason: promptTools }
      }
    }
    return buildAnalyzePagePlan(includePrompt, preferred)
  }

  if (workflowId === 'learningPath') {
    const required = ['detectLanguage', 'summarize', 'prompt']
    if (needsOutboundTranslation(preferred)) {
      required.push('translate')
    }
    const toolError = requireTools(tools, required)
    if (toolError) {
      return { ok: false, reason: toolError }
    }
    return buildLearningPathPlan(preferred)
  }

  const required = ['detectLanguage', 'summarize']
  if (needsOutboundTranslation(preferred)) {
    required.push('translate')
  }
  const toolError = requireTools(tools, required)
  if (toolError) {
    return { ok: false, reason: toolError }
  }
  return buildSummarizePagePlan(preferred)
}

export class Planner {
  plan(input: PlannerInput): PlanResult {
    const workflowId = resolveWorkflowId(input.goal.instruction)
    const preferred = preferredFromGoal(input.goal)
    return planWorkflow(
      workflowId,
      input.capabilities,
      input.tools,
      preferred,
      input.goal,
      input.pageContext,
    )
  }
}

export function createPlanner(): Planner {
  return new Planner()
}

export const PLANNER_RESPONSE_CONSTRAINTS = {
  concepts: CONCEPTS_CONSTRAINT,
  learningPath: LEARNING_PATH_CONSTRAINT,
  reply: REPLY_CONSTRAINT,
  query: QUERY_CONSTRAINT,
} as const
