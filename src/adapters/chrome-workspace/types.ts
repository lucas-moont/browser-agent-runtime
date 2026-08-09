export const AGENT_WORKSPACE_TITLE = 'Browser Agent'
export const AGENT_WORKSPACE_COLOR = 'blue' as const

export type WorkspaceTabInfo = {
  tabId: number
  title: string
  url: string
  active: boolean
}

export type WebSearchResultItem = {
  title: string
  url: string
  snippet: string
}

export type WebSearchResult = {
  query: string
  url: string
  mainText: string
  results: WebSearchResultItem[]
  mode: 'fetch' | 'tab'
  tabId?: number
}

export type AgentWorkspacePort = {
  /** Always create a new AgentWorkspace group seeded with this tab (one session). */
  createSession(seedTabId: number): Promise<number>
  /** Ungroup all tabs in the session group; tabs stay open. Idempotent if group is gone. */
  endSession(groupId: number): Promise<void>
  listTabs(groupId: number): Promise<WorkspaceTabInfo[]>
  inviteTab(groupId: number, tabId: number): Promise<void>
  openTab(groupId: number, url: string): Promise<number>
  navigateTab(groupId: number, tabId: number, url: string): Promise<void>
  closeTab(groupId: number, tabId: number): Promise<void>
  searchWeb(groupId: number, query: string): Promise<WebSearchResult>
}

export function isAllowedWorkspaceUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
