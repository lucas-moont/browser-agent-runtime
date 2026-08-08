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

function preferredFromGoal(goal: Goal): PreferredLanguage {
  return parsePreferredLanguage(goal.context?.preferredLanguage)
}

function isUsable(readiness: string | undefined): boolean {
  return readiness === 'available' || readiness === 'downloadable' || readiness === 'downloading'
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
): PlanResult {
  const workingFoundation = workingFoundationLanguage(preferred)
  const history = formatConversationHistory(goal.context?.conversationHistory)
  const instruction = goal.instruction.trim()

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
    {
      id: 'reply',
      tool: 'prompt',
      input: {
        sourceLanguage: { $from: 'detect.language' },
        responseConstraint: REPLY_CONSTRAINT,
        text: {
          $concat: [
            `You are a helpful assistant for the current browser page. Answer the user's request using the page summary. Be concise and useful.\n\nUser request:\n${instruction}\n\nPrior conversation:\n${history}\n\nPage summary:\n`,
            { $from: 'summarize.summary' },
            '\n\nReturn JSON with a single string field "reply" containing your answer.',
          ],
        },
      },
      dependsOn: ['summarize'],
    },
  ]

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
): PlanResult {
  const baseMissing = [
    missingCapability(capabilities, 'languageDetector'),
    missingCapability(capabilities, 'summarizer'),
  ].filter((id): id is string => id !== null)

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
    const required = ['detectLanguage', 'summarize', 'prompt']
    if (needsOutboundTranslation(preferred)) {
      required.push('translate')
    }
    const toolError = requireTools(tools, required)
    if (toolError) {
      return { ok: false, reason: toolError }
    }
    return buildConversationalPlan(preferred, goal)
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
} as const
