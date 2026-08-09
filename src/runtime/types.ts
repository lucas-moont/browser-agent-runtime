export type ConversationTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type GoalContext = {
  preferredLanguage?: string
  /** Prior turns in the side-panel Conversation (excluding the current Goal). */
  conversationHistory?: ConversationTurn[]
}

export type Goal = {
  instruction: string
  context?: GoalContext
}

export type AgentStep = {
  id: string
  tool: string
  input: unknown
  dependsOn?: string[]
}

export type WorkflowId =
  | 'analyzePage'
  | 'learningPath'
  | 'summarizePage'
  | 'conversational'

export type Plan = {
  workflowId: WorkflowId
  steps: AgentStep[]
}

export type PlanFailure = {
  ok: false
  reason: string
  missingCapabilities?: string[]
}

export type PlanSuccess = {
  ok: true
  plan: Plan
}

export type PlanResult = PlanSuccess | PlanFailure

export type AgentEventType =
  | 'goal_received'
  | 'context_collected'
  | 'plan_created'
  | 'tool_started'
  | 'tool_completed'
  | 'agent_completed'
  | 'agent_failed'
  | 'agent_cancelled'

export type AgentEvent = {
  type: AgentEventType
  at: number
  stepId?: string
  tool?: string
  reason?: string
  workflowId?: WorkflowId
}

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export type AgentState = {
  status: AgentStatus
  goal: Goal | null
  context: unknown
  plan: AgentStep[]
  workflowId?: WorkflowId
  outputs: Record<string, unknown>
  events: AgentEvent[]
  result?: unknown
  error?: string
}

export type ToolCatalogEntry = {
  name: string
  description: string
  capabilities: string[]
}

export type CapabilitySnapshotLike = Record<string, string>
