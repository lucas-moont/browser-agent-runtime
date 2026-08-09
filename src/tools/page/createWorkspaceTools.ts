import { z } from 'zod'
import type { AgentWorkspacePort } from '../../adapters/chrome-workspace'
import { isAllowedWorkspaceUrl } from '../../adapters/chrome-workspace'
import type { AgentTool, ToolContext } from '../types'
import { ToolError } from '../types'

function requireGroupId(context: ToolContext | undefined): number {
  const groupId = context?.groupId
  if (typeof groupId !== 'number' || !Number.isInteger(groupId) || groupId < 0) {
    throw new ToolError('adapter_error', 'Workspace tools require ToolContext.groupId')
  }
  return groupId
}

export function createListWorkspaceTabsTool(
  workspace: AgentWorkspacePort,
): AgentTool {
  return {
    name: 'listWorkspaceTabs',
    description: 'List WorkspaceTabs in the AgentWorkspace',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: z.strictObject({}),
    outputSchema: z.strictObject({
      groupId: z.number().int(),
      tabs: z.array(
        z.strictObject({
          tabId: z.number().int(),
          title: z.string(),
          url: z.string(),
          active: z.boolean(),
        }),
      ),
    }),
    async execute(_input, context) {
      const groupId = requireGroupId(context)
      const tabs = await workspace.listTabs(groupId)
      return { groupId, tabs }
    },
  }
}

export function createOpenWorkspaceTabTool(workspace: AgentWorkspacePort): AgentTool {
  return {
    name: 'openWorkspaceTab',
    description: 'Open an http(s) URL as a new WorkspaceTab',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: z.strictObject({ url: z.string().min(1) }),
    outputSchema: z.strictObject({ tabId: z.number().int() }),
    async execute(input, context) {
      const groupId = requireGroupId(context)
      const url = String((input as { url: string }).url)
      if (!isAllowedWorkspaceUrl(url)) {
        throw new ToolError('validation', 'Only http(s) URLs are allowed')
      }
      const tabId = await workspace.openTab(groupId, url)
      return { tabId }
    },
  }
}

export function createNavigateWorkspaceTabTool(workspace: AgentWorkspacePort): AgentTool {
  return {
    name: 'navigateWorkspaceTab',
    description: 'Navigate a WorkspaceTab to an http(s) URL',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: z.strictObject({
      tabId: z.number().int().nonnegative(),
      url: z.string().min(1),
    }),
    outputSchema: z.strictObject({
      tabId: z.number().int(),
      url: z.string(),
    }),
    async execute(input, context) {
      const groupId = requireGroupId(context)
      const { tabId, url } = input as { tabId: number; url: string }
      if (!isAllowedWorkspaceUrl(url)) {
        throw new ToolError('validation', 'Only http(s) URLs are allowed')
      }
      await workspace.navigateTab(groupId, tabId, url)
      return { tabId, url }
    },
  }
}

export function createCloseWorkspaceTabTool(workspace: AgentWorkspacePort): AgentTool {
  return {
    name: 'closeWorkspaceTab',
    description: 'Close a WorkspaceTab in the AgentWorkspace',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: z.strictObject({ tabId: z.number().int().nonnegative() }),
    outputSchema: z.strictObject({ tabId: z.number().int() }),
    async execute(input, context) {
      const groupId = requireGroupId(context)
      const tabId = (input as { tabId: number }).tabId
      await workspace.closeTab(groupId, tabId)
      return { tabId }
    },
  }
}

export function createSearchWebTool(workspace: AgentWorkspacePort): AgentTool {
  return {
    name: 'searchWeb',
    description:
      'Search the web via background DuckDuckGo fetch (Google tab fallback); returns SERP text for grounding',
    capabilities: [],
    dataBoundary: 'BROWSER',
    inputSchema: z.strictObject({
      query: z.string().optional(),
      fallbackQuery: z.string().optional(),
    }),
    outputSchema: z.strictObject({
      query: z.string(),
      url: z.string(),
      mainText: z.string(),
      results: z.array(
        z.strictObject({
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
        }),
      ),
      mode: z.enum(['fetch', 'tab']),
      tabId: z.number().int().optional(),
    }),
    async execute(input, context) {
      const groupId = requireGroupId(context)
      const raw = input as { query?: unknown; fallbackQuery?: unknown }
      const primary = typeof raw.query === 'string' ? raw.query.trim() : ''
      const fallback = typeof raw.fallbackQuery === 'string' ? raw.fallbackQuery.trim() : ''
      const query = primary || fallback
      if (!query) {
        throw new ToolError('validation', 'searchWeb requires a non-empty query')
      }
      return workspace.searchWeb(groupId, query)
    },
  }
}
