import { z } from 'zod'
import type { AgentWorkspacePort } from '../../adapters/chrome-workspace'
import { pageSnapshotSchema } from '../../messaging'
import type { AgentTool, ToolContext } from '../types'
import { ToolError } from '../types'

const DEFAULT_MAX_TABS = 5
const DEFAULT_MAX_CHARS = 8000

const extractWorkspacePagesInputSchema = z.strictObject({
  maxTabs: z.number().int().positive().max(20).optional(),
  maxCharsPerTab: z.number().int().positive().max(100_000).optional(),
})

const workspacePageSchema = pageSnapshotSchema.extend({
  tabId: z.number().int().nonnegative(),
})

const extractWorkspacePagesOutputSchema = z.strictObject({
  pages: z.array(workspacePageSchema),
  errors: z.array(
    z.strictObject({
      tabId: z.number().int().nonnegative(),
      message: z.string(),
    }),
  ),
  mainText: z.string(),
  title: z.string(),
  url: z.string(),
  selection: z.string(),
})

export type ExtractWorkspacePagesInput = z.infer<typeof extractWorkspacePagesInputSchema>
export type ExtractWorkspacePagesOutput = z.infer<typeof extractWorkspacePagesOutputSchema>

export type ExtractWorkspacePagesDeps = {
  workspace: AgentWorkspacePort
  extractPage: (
    input: { tabId?: number },
    context?: ToolContext,
  ) => Promise<{
    title: string
    url: string
    selection: string
    mainText: string
  }>
}

function requireGroupId(context: ToolContext | undefined): number {
  const groupId = context?.groupId
  if (typeof groupId !== 'number' || !Number.isInteger(groupId) || groupId < 0) {
    throw new ToolError('adapter_error', 'extractWorkspacePages requires ToolContext.groupId')
  }
  return groupId
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n…[truncated]`
}

export function createExtractWorkspacePagesTool(
  deps: ExtractWorkspacePagesDeps,
): AgentTool<ExtractWorkspacePagesInput, ExtractWorkspacePagesOutput> {
  return {
    name: 'extractWorkspacePages',
    description: 'Extract truncated PageContext from WorkspaceTabs in the AgentWorkspace',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: extractWorkspacePagesInputSchema,
    outputSchema: extractWorkspacePagesOutputSchema,
    async execute(input, context) {
      const groupId = requireGroupId(context)
      const maxTabs = input.maxTabs ?? DEFAULT_MAX_TABS
      const maxChars = input.maxCharsPerTab ?? DEFAULT_MAX_CHARS
      const tabs = (await deps.workspace.listTabs(groupId)).slice(0, maxTabs)

      const pages: ExtractWorkspacePagesOutput['pages'] = []
      const errors: ExtractWorkspacePagesOutput['errors'] = []

      for (const tab of tabs) {
        try {
          const page = await deps.extractPage({ tabId: tab.tabId }, context)
          pages.push({
            tabId: tab.tabId,
            title: page.title || tab.title,
            url: page.url || tab.url,
            selection: page.selection,
            mainText: truncate(page.mainText, maxChars),
          })
        } catch (cause) {
          errors.push({
            tabId: tab.tabId,
            message: cause instanceof Error ? cause.message : 'extract failed',
          })
        }
      }

      if (pages.length === 0) {
        throw new ToolError(
          'adapter_error',
          errors[0]?.message ?? 'No WorkspaceTabs could be extracted',
        )
      }

      const mainText = pages
        .map((page) => `# ${page.title}\nURL: ${page.url}\n\n${page.mainText}`)
        .join('\n\n---\n\n')

      return {
        pages,
        errors,
        mainText,
        title: pages.map((page) => page.title).join(' · '),
        url: pages[0]?.url ?? '',
        selection: '',
      }
    },
  }
}
