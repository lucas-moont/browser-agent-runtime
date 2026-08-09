import {
  AGENT_WORKSPACE_COLOR,
  AGENT_WORKSPACE_TITLE,
  isAllowedWorkspaceUrl,
  type AgentWorkspacePort,
  type WorkspaceTabInfo,
} from './types'

export type ChromeWorkspaceApi = {
  tabGroups: {
    query(queryInfo: chrome.tabGroups.QueryInfo): Promise<chrome.tabGroups.TabGroup[]>
    update(
      groupId: number,
      updateProperties: chrome.tabGroups.UpdateProperties,
    ): Promise<chrome.tabGroups.TabGroup | undefined>
  }
  tabs: {
    query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>
    get(tabId: number): Promise<chrome.tabs.Tab>
    group(options: chrome.tabs.GroupOptions): Promise<number>
    create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>
    update(
      tabId: number,
      updateProperties: chrome.tabs.UpdateProperties,
    ): Promise<chrome.tabs.Tab | undefined>
    remove(tabIds: number | number[]): Promise<void>
  }
  windows: {
    getCurrent(): Promise<chrome.windows.Window>
  }
}

async function requireGroupMembership(
  api: ChromeWorkspaceApi,
  groupId: number,
  tabId: number,
): Promise<void> {
  const tabs = await api.tabs.query({ groupId })
  if (!tabs.some((tab) => tab.id === tabId)) {
    throw new Error(`Tab ${tabId} is not in the AgentWorkspace`)
  }
}

async function waitForTabComplete(
  api: ChromeWorkspaceApi,
  tabId: number,
  timeoutMs = 20_000,
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const tab = await api.tabs.get(tabId)
    if (tab.status === 'complete') {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

export function buildWebSearchUrl(query: string): string {
  const trimmed = query.trim()
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

export function createChromeAgentWorkspace(
  chromeApi: ChromeWorkspaceApi = chrome as unknown as ChromeWorkspaceApi,
): AgentWorkspacePort {
  return {
    async ensureWorkspace() {
      const current = await chromeApi.windows.getCurrent()
      const windowId = current.id
      const existing = await chromeApi.tabGroups.query({
        title: AGENT_WORKSPACE_TITLE,
        ...(typeof windowId === 'number' ? { windowId } : {}),
      })
      if (existing[0]) {
        await chromeApi.tabGroups.update(existing[0].id, {
          title: AGENT_WORKSPACE_TITLE,
          color: AGENT_WORKSPACE_COLOR,
        })
        return existing[0].id
      }

      const seedTabs = await chromeApi.tabs.query({
        active: true,
        ...(typeof windowId === 'number' ? { windowId } : { currentWindow: true }),
      })
      const seedId = seedTabs[0]?.id
      if (typeof seedId !== 'number') {
        throw new Error('No active tab available to create AgentWorkspace')
      }

      const groupId = await chromeApi.tabs.group({
        tabIds: seedId,
        ...(typeof windowId === 'number' ? { createProperties: { windowId } } : {}),
      })
      await chromeApi.tabGroups.update(groupId, {
        title: AGENT_WORKSPACE_TITLE,
        color: AGENT_WORKSPACE_COLOR,
      })
      return groupId
    },

    async listTabs(groupId) {
      const tabs = await chromeApi.tabs.query({ groupId })
      return tabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
        .map(
          (tab): WorkspaceTabInfo => ({
            tabId: tab.id,
            title: tab.title ?? '',
            url: tab.url ?? tab.pendingUrl ?? '',
            active: Boolean(tab.active),
          }),
        )
    },

    async inviteTab(groupId, tabId) {
      await chromeApi.tabs.group({ groupId, tabIds: tabId })
    },

    async openTab(groupId, url) {
      if (!isAllowedWorkspaceUrl(url)) {
        throw new Error('Only http(s) URLs are allowed in the AgentWorkspace')
      }
      const tab = await chromeApi.tabs.create({ url, active: false })
      if (typeof tab.id !== 'number') {
        throw new Error('Failed to create workspace tab')
      }
      await chromeApi.tabs.group({ groupId, tabIds: tab.id })
      await waitForTabComplete(chromeApi, tab.id)
      return tab.id
    },

    async navigateTab(groupId, tabId, url) {
      if (!isAllowedWorkspaceUrl(url)) {
        throw new Error('Only http(s) URLs are allowed in the AgentWorkspace')
      }
      await requireGroupMembership(chromeApi, groupId, tabId)
      await chromeApi.tabs.update(tabId, { url })
      await waitForTabComplete(chromeApi, tabId)
    },

    async closeTab(groupId, tabId) {
      await requireGroupMembership(chromeApi, groupId, tabId)
      await chromeApi.tabs.remove(tabId)
    },

    async searchWeb(groupId, query) {
      const url = buildWebSearchUrl(query)
      const tabId = await this.openTab(groupId, url)
      return { tabId, url, query: query.trim() }
    },
  }
}
