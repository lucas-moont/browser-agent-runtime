import type { AgentWorkspacePort } from '../../adapters/chrome-workspace'
import type { MessagingTransport } from '../../messaging'
import type { ToolRegistry } from '../ToolRegistry'
import { createExtractPageTool } from './createExtractPageTool'
import { createExtractWorkspacePagesTool } from './createExtractWorkspacePagesTool'
import { createInspectPageContextTool } from './createInspectPageContextTool'
import {
  createCloseWorkspaceTabTool,
  createListWorkspaceTabsTool,
  createNavigateWorkspaceTabTool,
  createOpenWorkspaceTabTool,
  createSearchWebTool,
} from './createWorkspaceTools'

export type RegisterPageToolsOptions = {
  transport: MessagingTransport
  workspace?: AgentWorkspacePort
  createRequestId?: () => string
}

export function registerPageTools(
  registry: ToolRegistry,
  options: RegisterPageToolsOptions,
): void {
  const extractPage = createExtractPageTool({
    transport: options.transport,
    createRequestId: options.createRequestId,
  })
  registry.register(extractPage)
  registry.register(
    createInspectPageContextTool({
      transport: options.transport,
      createRequestId: options.createRequestId,
    }),
  )

  if (!options.workspace) {
    return
  }

  const workspace = options.workspace
  registry.register(createListWorkspaceTabsTool(workspace))
  registry.register(createOpenWorkspaceTabTool(workspace))
  registry.register(createNavigateWorkspaceTabTool(workspace))
  registry.register(createCloseWorkspaceTabTool(workspace))
  registry.register(createSearchWebTool(workspace))
  registry.register(
    createExtractWorkspacePagesTool({
      workspace,
      extractPage: (input, context) => extractPage.execute(input, context),
    }),
  )
}
