import type { CapabilityRegistry, CapabilitySnapshot } from '../capabilities/CapabilityRegistry'
import type { ToolRegistry } from '../tools/ToolRegistry'
import { createAllowByDefaultPolicy, type Policy } from './policy'
import { createPlanner, type Planner } from './Planner'
import {
  needsOutboundTranslation,
  parsePreferredLanguage,
  workingFoundationLanguage,
  type PreferredLanguage,
} from './preferredLanguage'
import { validateDemoResult } from './results'
import type {
  AgentEvent,
  AgentState,
  Goal,
  Plan,
  ToolCatalogEntry,
  WorkflowId,
} from './types'
import { createWorkflowExecutor, type WorkflowExecutor } from './WorkflowExecutor'

export type AgentRuntimeDeps = {
  capabilities: CapabilityRegistry
  tools: ToolRegistry
  planner?: Planner
  executor?: WorkflowExecutor
  policy?: Policy
  now?: () => number
  collectPageContext?: (toolContext?: { tabId?: number; groupId?: number }) => Promise<unknown>
}

export type AgentRunOptions = {
  goal: Goal
  tabId?: number
  groupId?: number
  signal?: AbortSignal
}

const LOCALIZE_SKIP_KEYS = new Set([
  'language',
  'foundationLanguage',
  'preferredLanguage',
  'translatedInbound',
])

function emptyState(): AgentState {
  return {
    status: 'idle',
    goal: null,
    context: null,
    plan: [],
    outputs: {},
    events: [],
  }
}

function catalogFromTools(tools: ToolRegistry): ToolCatalogEntry[] {
  return tools.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    capabilities: [...tool.capabilities],
  }))
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function preferredFromGoal(goal: Goal): PreferredLanguage {
  return parsePreferredLanguage(goal.context?.preferredLanguage)
}

function buildAnalyzeResult(
  outputs: Record<string, unknown>,
  preferred: PreferredLanguage,
): unknown {
  const detect = asRecord(outputs.detect)
  const summarize = asRecord(outputs.summarize)
  const conceptsOut = asRecord(outputs.concepts)
  const structured = asRecord(conceptsOut.structured)
  return {
    language: detect.language ?? 'unknown',
    summary: summarize.summary ?? '',
    topics: structured.topics ?? [],
    concepts: structured.concepts ?? [],
    preferredLanguage: preferred,
  }
}

function buildLearningPathResult(
  outputs: Record<string, unknown>,
  preferred: PreferredLanguage,
): unknown {
  const learning = asRecord(outputs.learningPath)
  const structured = asRecord(learning.structured)
  return {
    prerequisites: structured.prerequisites ?? [],
    concepts: structured.concepts ?? [],
    sequence: structured.sequence ?? [],
    nextTopics: structured.nextTopics ?? [],
    preferredLanguage: preferred,
  }
}

function buildSummarizePageResult(
  outputs: Record<string, unknown>,
  preferred: PreferredLanguage,
): unknown {
  const detect = asRecord(outputs.detect)
  const summarize = asRecord(outputs.summarize)
  const translateOut = asRecord(outputs.translateResult)
  const summary = needsOutboundTranslation(preferred)
    ? (translateOut.text ?? '')
    : (summarize.summary ?? '')
  return {
    language: detect.language ?? 'unknown',
    summary,
    foundationLanguage: summarize.foundationLanguage ?? 'en',
    translatedInbound: Boolean(summarize.translatedInbound),
    preferredLanguage: preferred,
  }
}

function buildConversationalResult(
  outputs: Record<string, unknown>,
  preferred: PreferredLanguage,
): unknown {
  const detect = asRecord(outputs.detect)
  const replyOut = asRecord(outputs.reply)
  const structured = asRecord(replyOut.structured)
  let reply: unknown
  if (typeof structured.reply === 'string') {
    reply = structured.reply
  } else if ('reply' in structured) {
    reply = structured.reply
  } else if (typeof replyOut.text === 'string') {
    reply = replyOut.text
  } else {
    reply = ''
  }
  return {
    reply,
    language: detect.language ?? 'unknown',
    preferredLanguage: preferred,
  }
}

function buildResult(
  workflowId: WorkflowId,
  outputs: Record<string, unknown>,
  preferred: PreferredLanguage,
): unknown {
  if (workflowId === 'analyzePage') {
    return buildAnalyzeResult(outputs, preferred)
  }
  if (workflowId === 'learningPath') {
    return buildLearningPathResult(outputs, preferred)
  }
  if (workflowId === 'conversational') {
    return buildConversationalResult(outputs, preferred)
  }
  return buildSummarizePageResult(outputs, preferred)
}

async function translateString(
  tools: ToolRegistry,
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string> {
  if (!text) {
    return text
  }
  const translated = await tools.execute('translate', {
    text,
    sourceLanguage,
    targetLanguage,
  })
  const record = asRecord(translated)
  return typeof record.text === 'string' ? record.text : text
}

export async function localizeResult(
  result: unknown,
  preferred: PreferredLanguage,
  tools: ToolRegistry,
  sourceLanguage: string,
): Promise<unknown> {
  if (!needsOutboundTranslation(preferred)) {
    return result
  }

  async function walk(value: unknown, key?: string): Promise<unknown> {
    if (typeof value === 'string') {
      if (key && LOCALIZE_SKIP_KEYS.has(key)) {
        return value
      }
      return translateString(tools, value, sourceLanguage, preferred)
    }
    if (Array.isArray(value)) {
      const next: unknown[] = []
      for (const item of value) {
        next.push(await walk(item))
      }
      return next
    }
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const next: Record<string, unknown> = {}
      for (const [entryKey, entryValue] of Object.entries(record)) {
        next[entryKey] = await walk(entryValue, entryKey)
      }
      return next
    }
    return value
  }

  return walk(result)
}

export class AgentRuntime {
  private readonly capabilities: CapabilityRegistry
  private readonly tools: ToolRegistry
  private readonly planner: Planner
  private readonly executor: WorkflowExecutor
  private readonly policy: Policy
  private readonly now: () => number
  private readonly collectPageContext: (toolContext?: {
    tabId?: number
    groupId?: number
  }) => Promise<unknown>
  private state: AgentState = emptyState()
  private running = false

  constructor(deps: AgentRuntimeDeps) {
    this.capabilities = deps.capabilities
    this.tools = deps.tools
    this.planner = deps.planner ?? createPlanner()
    this.executor = deps.executor ?? createWorkflowExecutor()
    this.policy = deps.policy ?? createAllowByDefaultPolicy()
    this.now = deps.now ?? (() => Date.now())
    this.collectPageContext =
      deps.collectPageContext ??
      (async (toolContext) => {
        if (toolContext?.groupId !== undefined && this.tools.get('extractWorkspacePages')) {
          try {
            return await this.tools.execute('extractWorkspacePages', {}, toolContext)
          } catch {
            // fall through to single-tab extract
          }
        }
        return this.tools.execute('extractPage', {}, toolContext)
      })
  }

  getState(): AgentState {
    return {
      ...this.state,
      plan: [...this.state.plan],
      outputs: { ...this.state.outputs },
      events: [...this.state.events],
    }
  }

  private emit(event: Omit<AgentEvent, 'at'> & { at?: number }): void {
    this.state.events.push({
      ...event,
      at: event.at ?? this.now(),
    })
  }

  private fail(reason: string): AgentState {
    this.state.status = 'failed'
    this.state.error = reason
    this.emit({ type: 'agent_failed', reason })
    this.running = false
    return this.getState()
  }

  private cancel(reason = 'Cancelled'): AgentState {
    this.state.status = 'cancelled'
    this.state.error = reason
    this.emit({ type: 'agent_cancelled', reason })
    this.running = false
    return this.getState()
  }

  async run(options: AgentRunOptions): Promise<AgentState> {
    if (this.running) {
      throw new Error('AgentRuntime already has an active run')
    }

    this.running = true
    this.state = {
      ...emptyState(),
      status: 'running',
      goal: options.goal,
    }

    this.emit({ type: 'goal_received' })

    if (options.signal?.aborted) {
      return this.cancel()
    }

    const policyDecision = this.policy.authorizeGoal(options.goal)
    if (!policyDecision.allowed) {
      return this.fail(policyDecision.reason)
    }

    const preferred = preferredFromGoal(options.goal)
    const workingFoundation = workingFoundationLanguage(preferred)
    const toolContext =
      options.tabId !== undefined || options.groupId !== undefined || options.signal !== undefined
        ? { tabId: options.tabId, groupId: options.groupId, signal: options.signal }
        : undefined

    let pageContext: unknown
    try {
      pageContext = await this.collectPageContext(toolContext)
      this.state.context = pageContext
      this.emit({ type: 'context_collected' })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to collect PageContext'
      return this.fail(reason)
    }

    if (options.signal?.aborted) {
      return this.cancel()
    }

    let snapshot: CapabilitySnapshot
    try {
      snapshot = await this.capabilities.snapshot({
        translator: {
          sourceLanguage: workingFoundation,
          targetLanguage: preferred,
        },
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Capability probe failed'
      return this.fail(reason)
    }

    const planResult = this.planner.plan({
      goal: options.goal,
      capabilities: snapshot,
      tools: catalogFromTools(this.tools),
      pageContext,
    })

    if (!planResult.ok) {
      return this.fail(planResult.reason)
    }

    const plan: Plan = planResult.plan
    this.state.plan = plan.steps
    this.state.workflowId = plan.workflowId
    this.emit({ type: 'plan_created', workflowId: plan.workflowId })

    if (options.signal?.aborted) {
      return this.cancel()
    }

    const execution = await this.executor.execute({
      plan,
      tools: this.tools,
      context: pageContext,
      toolContext,
      signal: options.signal,
      now: this.now,
      onEvent: (event) => {
        if (event.type === 'tool_started') {
          this.emit({
            type: 'tool_started',
            at: event.at,
            stepId: event.stepId,
            tool: event.tool,
          })
        } else if (event.type === 'tool_completed') {
          this.emit({
            type: 'tool_completed',
            at: event.at,
            stepId: event.stepId,
            tool: event.tool,
          })
        }
      },
    })

    this.state.outputs = execution.outputs

    if (!execution.ok) {
      if (execution.cancelled || options.signal?.aborted) {
        return this.cancel(execution.reason)
      }
      return this.fail(execution.reason)
    }

    if (plan.workflowId === 'conversational') {
      const search = asRecord(execution.outputs.search)
      if ('mainText' in search) {
        const mainText = search.mainText
        if (typeof mainText !== 'string' || mainText.trim().length === 0) {
          return this.fail(
            'Search results were empty or blocked — cannot ground a research reply',
          )
        }
      }
    }

    let rawResult = buildResult(plan.workflowId, execution.outputs, preferred)

    if (
      (plan.workflowId === 'analyzePage' ||
        plan.workflowId === 'learningPath' ||
        plan.workflowId === 'conversational') &&
      needsOutboundTranslation(preferred)
    ) {
      try {
        rawResult = await localizeResult(
          rawResult,
          preferred,
          this.tools,
          workingFoundation,
        )
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : 'Failed to localize Result'
        return this.fail(reason)
      }
    }

    const validated = validateDemoResult(plan.workflowId, rawResult)
    if (!validated.ok) {
      return this.fail('Result failed Zod validation')
    }

    this.state.result = validated.value
    this.state.status = 'completed'
    this.emit({ type: 'agent_completed' })
    this.running = false
    return this.getState()
  }
}

export function createAgentRuntime(deps: AgentRuntimeDeps): AgentRuntime {
  return new AgentRuntime(deps)
}
