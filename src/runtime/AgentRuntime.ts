import type { CapabilityRegistry, CapabilitySnapshot } from '../capabilities/CapabilityRegistry'
import type { ToolRegistry } from '../tools/ToolRegistry'
import { createAllowByDefaultPolicy, type Policy } from './policy'
import { createPlanner, type Planner } from './Planner'
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
  collectPageContext?: (toolContext?: { tabId?: number }) => Promise<unknown>
}

export type AgentRunOptions = {
  goal: Goal
  tabId?: number
}

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

function buildAnalyzeResult(outputs: Record<string, unknown>): unknown {
  const detect = asRecord(outputs.detect)
  const summarize = asRecord(outputs.summarize)
  const conceptsOut = asRecord(outputs.concepts)
  const structured = asRecord(conceptsOut.structured)
  return {
    language: detect.language ?? 'unknown',
    summary: summarize.summary ?? '',
    topics: structured.topics ?? [],
    concepts: structured.concepts ?? [],
  }
}

function buildLearningPathResult(outputs: Record<string, unknown>): unknown {
  const learning = asRecord(outputs.learningPath)
  const structured = asRecord(learning.structured)
  return {
    prerequisites: structured.prerequisites ?? [],
    concepts: structured.concepts ?? [],
    sequence: structured.sequence ?? [],
    nextTopics: structured.nextTopics ?? [],
  }
}

function buildSummarizeInPortugueseResult(outputs: Record<string, unknown>): unknown {
  const detect = asRecord(outputs.detect)
  const summarize = asRecord(outputs.summarize)
  const translatePt = asRecord(outputs.translatePt)
  return {
    language: detect.language ?? 'unknown',
    summaryPt: translatePt.text ?? '',
    foundationLanguage: summarize.foundationLanguage ?? 'en',
    translatedInbound: Boolean(summarize.translatedInbound),
  }
}

function buildResult(workflowId: WorkflowId, outputs: Record<string, unknown>): unknown {
  if (workflowId === 'analyzePage') {
    return buildAnalyzeResult(outputs)
  }
  if (workflowId === 'learningPath') {
    return buildLearningPathResult(outputs)
  }
  return buildSummarizeInPortugueseResult(outputs)
}

export class AgentRuntime {
  private readonly capabilities: CapabilityRegistry
  private readonly tools: ToolRegistry
  private readonly planner: Planner
  private readonly executor: WorkflowExecutor
  private readonly policy: Policy
  private readonly now: () => number
  private readonly collectPageContext: (toolContext?: { tabId?: number }) => Promise<unknown>
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
      (async (toolContext) => this.tools.execute('extractPage', {}, toolContext))
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

    const policyDecision = this.policy.authorizeGoal(options.goal)
    if (!policyDecision.allowed) {
      return this.fail(policyDecision.reason)
    }

    const toolContext = options.tabId !== undefined ? { tabId: options.tabId } : undefined

    let pageContext: unknown
    try {
      pageContext = await this.collectPageContext(toolContext)
      this.state.context = pageContext
      this.emit({ type: 'context_collected' })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to collect PageContext'
      return this.fail(reason)
    }

    let snapshot: CapabilitySnapshot
    try {
      snapshot = await this.capabilities.snapshot({
        translator: { sourceLanguage: 'en', targetLanguage: 'pt' },
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

    const execution = await this.executor.execute({
      plan,
      tools: this.tools,
      context: pageContext,
      toolContext,
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
      return this.fail(execution.reason)
    }

    const rawResult = buildResult(plan.workflowId, execution.outputs)
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
