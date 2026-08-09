import type { z } from 'zod'
import type { CapabilityId } from '../capabilities/CapabilityRegistry'

export type DataBoundary = 'LOCAL' | 'BROWSER' | 'EXTERNAL'

export type ToolContext = {
  tabId?: number
  groupId?: number
  signal?: AbortSignal
}

export type AgentTool<TInput = unknown, TOutput = unknown> = {
  name: string
  description: string
  capabilities: CapabilityId[]
  dataBoundary: DataBoundary
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
  execute(input: TInput, context?: ToolContext): Promise<TOutput>
}

export type ToolErrorCode =
  | 'unknown_tool'
  | 'duplicate_tool'
  | 'invalid_input'
  | 'invalid_output'
  | 'capability_unavailable'
  | 'adapter_error'
  | 'validation'

export class ToolError extends Error {
  readonly code: ToolErrorCode
  readonly capabilityId?: string
  readonly issues?: unknown

  constructor(
    code: ToolErrorCode,
    message: string,
    options?: { capabilityId?: string; issues?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ToolError'
    this.code = code
    this.capabilityId = options?.capabilityId
    this.issues = options?.issues
  }
}

export class DuplicateToolError extends ToolError {
  constructor(toolName: string) {
    super('duplicate_tool', `Tool already registered: ${toolName}`)
    this.name = 'DuplicateToolError'
  }
}

export class UnknownToolError extends ToolError {
  constructor(toolName: string) {
    super('unknown_tool', `Unknown tool: ${toolName}`)
    this.name = 'UnknownToolError'
  }
}

export class ToolInputValidationError extends ToolError {
  constructor(toolName: string, issues?: unknown) {
    super('invalid_input', `Invalid input for tool: ${toolName}`, { issues })
    this.name = 'ToolInputValidationError'
  }
}

export class ToolOutputValidationError extends ToolError {
  constructor(toolName: string, issues?: unknown) {
    super('invalid_output', `Invalid output for tool: ${toolName}`, { issues })
    this.name = 'ToolOutputValidationError'
  }
}
