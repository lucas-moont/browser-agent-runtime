export const AGENT_WORKSPACE_TITLE = 'Browser Agent'
export const AGENT_WORKSPACE_COLOR = 'blue' as const

export type WorkspaceTabInfo = {
  tabId: number
  title: string
  url: string
  active: boolean
}

export type AgentWorkspacePort = {
  ensureWorkspace(): Promise<number>
  listTabs(groupId: number): Promise<WorkspaceTabInfo[]>
  inviteTab(groupId: number, tabId: number): Promise<void>
  openTab(groupId: number, url: string): Promise<number>
  navigateTab(groupId: number, tabId: number, url: string): Promise<void>
  closeTab(groupId: number, tabId: number): Promise<void>
  searchWeb(
    groupId: number,
    query: string,
  ): Promise<{ tabId: number; url: string; query: string }>
}

export function isAllowedWorkspaceUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
