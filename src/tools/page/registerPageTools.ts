import type { MessagingTransport } from '../../messaging'
import type { ToolRegistry } from '../ToolRegistry'
import { createExtractPageTool } from './createExtractPageTool'
import { createInspectPageContextTool } from './createInspectPageContextTool'

export type RegisterPageToolsOptions = {
  transport: MessagingTransport
  createRequestId?: () => string
}

export function registerPageTools(
  registry: ToolRegistry,
  options: RegisterPageToolsOptions,
): void {
  registry.register(
    createExtractPageTool({
      transport: options.transport,
      createRequestId: options.createRequestId,
    }),
  )
  registry.register(
    createInspectPageContextTool({
      transport: options.transport,
      createRequestId: options.createRequestId,
    }),
  )
}
