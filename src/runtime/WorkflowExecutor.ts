import { resolveStepInput } from './inputRefs'
import type { AgentStep, Plan } from './types'

export type WorkflowToolRegistry = {
  execute(name: string, input: unknown, context?: { tabId?: number }): Promise<unknown>
}

export type WorkflowExecutorEvent = {
  type: 'tool_started' | 'tool_completed' | 'tool_failed'
  at: number
  stepId: string
  tool: string
  reason?: string
}

export type WorkflowExecutorResult =
  | {
      ok: true
      outputs: Record<string, unknown>
      events: WorkflowExecutorEvent[]
    }
  | {
      ok: false
      outputs: Record<string, unknown>
      events: WorkflowExecutorEvent[]
      reason: string
      failedStepId?: string
    }

export type WorkflowExecutorOptions = {
  plan: Plan
  tools: WorkflowToolRegistry
  context?: unknown
  toolContext?: { tabId?: number }
  now?: () => number
  onEvent?: (event: WorkflowExecutorEvent) => void
}

function topoSort(steps: AgentStep[]): AgentStep[] | { error: string } {
  const byId = new Map(steps.map((step) => [step.id, step]))
  if (byId.size !== steps.length) {
    return { error: 'Plan contains duplicate step ids' }
  }

  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!byId.has(dep)) {
        return { error: `Unknown dependency "${dep}" for step "${step.id}"` }
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: AgentStep[] = []

  function visit(id: string): string | null {
    if (visited.has(id)) {
      return null
    }
    if (visiting.has(id)) {
      return `Cycle detected at step "${id}"`
    }
    visiting.add(id)
    const step = byId.get(id)
    if (!step) {
      return `Unknown step "${id}"`
    }
    for (const dep of step.dependsOn ?? []) {
      const err = visit(dep)
      if (err) {
        return err
      }
    }
    visiting.delete(id)
    visited.add(id)
    ordered.push(step)
    return null
  }

  for (const step of steps) {
    const err = visit(step.id)
    if (err) {
      return { error: err }
    }
  }

  return ordered
}

export class WorkflowExecutor {
  async execute(options: WorkflowExecutorOptions): Promise<WorkflowExecutorResult> {
    const now = options.now ?? (() => Date.now())
    const outputs: Record<string, unknown> = {}
    const events: WorkflowExecutorEvent[] = []
    const emit = (event: WorkflowExecutorEvent) => {
      events.push(event)
      options.onEvent?.(event)
    }

    const ordered = topoSort(options.plan.steps)
    if ('error' in ordered) {
      return {
        ok: false,
        outputs,
        events,
        reason: ordered.error,
      }
    }

    for (const step of ordered) {
      const started: WorkflowExecutorEvent = {
        type: 'tool_started',
        at: now(),
        stepId: step.id,
        tool: step.tool,
      }
      emit(started)

      let resolvedInput: unknown
      try {
        resolvedInput = resolveStepInput(step.input, outputs, options.context)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Failed to resolve step input'
        emit({
          type: 'tool_failed',
          at: now(),
          stepId: step.id,
          tool: step.tool,
          reason,
        })
        return {
          ok: false,
          outputs,
          events,
          reason,
          failedStepId: step.id,
        }
      }

      try {
        const output = await options.tools.execute(step.tool, resolvedInput, options.toolContext)
        outputs[step.id] = output
        emit({
          type: 'tool_completed',
          at: now(),
          stepId: step.id,
          tool: step.tool,
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Tool execution failed'
        emit({
          type: 'tool_failed',
          at: now(),
          stepId: step.id,
          tool: step.tool,
          reason,
        })
        return {
          ok: false,
          outputs,
          events,
          reason,
          failedStepId: step.id,
        }
      }
    }

    return {
      ok: true,
      outputs,
      events,
    }
  }
}

export function createWorkflowExecutor(): WorkflowExecutor {
  return new WorkflowExecutor()
}
