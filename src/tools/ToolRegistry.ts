import {
  DuplicateToolError,
  ToolInputValidationError,
  ToolOutputValidationError,
  UnknownToolError,
  type AgentTool,
  type ToolContext,
} from './types'

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>()

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new DuplicateToolError(tool.name)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  list(): AgentTool[] {
    return [...this.tools.values()]
  }

  async execute(name: string, input: unknown, context?: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new UnknownToolError(name)
    }

    const parsedInput = tool.inputSchema.safeParse(input)
    if (!parsedInput.success) {
      throw new ToolInputValidationError(name, parsedInput.error.issues)
    }

    const output = await tool.execute(parsedInput.data, context)
    const parsedOutput = tool.outputSchema.safeParse(output)
    if (!parsedOutput.success) {
      throw new ToolOutputValidationError(name, parsedOutput.error.issues)
    }

    return parsedOutput.data
  }
}

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry()
}
