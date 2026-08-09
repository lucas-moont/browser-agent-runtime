import {
  AGENT_WORKSPACE_COLOR,
  AGENT_WORKSPACE_TITLE,
  isAllowedWorkspaceUrl,
  type AgentWorkspacePort,
  type WebSearchResult,
  type WorkspaceTabInfo,
} from './types'
import { fetchDuckDuckGoSerp } from './fetchSerp'

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
    ungroup(tabIds: number | number[]): Promise<void>
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
  scripting?: {
    executeScript(injection: {
      target: { tabId: number }
      func: () => string
    }): Promise<Array<{ result?: string }>>
  }
}

export type CreateChromeAgentWorkspaceOptions = {
  fetchImpl?: typeof fetch
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
  throw new Error(`Tab ${tabId} did not finish loading in time`)
}

export function buildWebSearchUrl(query: string): string {
  const trimmed = query.trim()
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
}

async function extractTabMainText(api: ChromeWorkspaceApi, tabId: number): Promise<string> {
  if (!api.scripting?.executeScript) {
    return ''
  }
  try {
    const injected = await api.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText ?? '',
    })
    const text = injected[0]?.result
    return typeof text === 'string' ? text : ''
  } catch {
    return ''
  }
}

async function searchViaGoogleTab(
  workspace: AgentWorkspacePort,
  api: ChromeWorkspaceApi,
  groupId: number,
  query: string,
): Promise<WebSearchResult> {
  const url = buildWebSearchUrl(query)
  const tabId = await workspace.openTab(groupId, url)
  const mainText = (await extractTabMainText(api, tabId)).trim()
  try {
    await workspace.closeTab(groupId, tabId)
  } catch {
    // Tab may already be gone; ignore.
  }
  return {
    query: query.trim(),
    url,
    mainText,
    results: [],
    mode: 'tab',
    tabId,
  }
}

export function createChromeAgentWorkspace(
  chromeApi: ChromeWorkspaceApi = chrome as unknown as ChromeWorkspaceApi,
  options: CreateChromeAgentWorkspaceOptions = {},
): AgentWorkspacePort {
  const workspace: AgentWorkspacePort = {
    async createSession(seedTabId) {
      const tab = await chromeApi.tabs.get(seedTabId)
      if (!isAllowedWorkspaceUrl(tab.url ?? tab.pendingUrl ?? '')) {
        throw new Error(
          'Open the extension on an http(s) page — this tab cannot join the Agent Workspace',
        )
      }

      const windowId = tab.windowId
      const groupId = await chromeApi.tabs.group({
        tabIds: seedTabId,
        ...(typeof windowId === 'number' ? { createProperties: { windowId } } : {}),
      })
      await chromeApi.tabGroups.update(groupId, {
        title: AGENT_WORKSPACE_TITLE,
        color: AGENT_WORKSPACE_COLOR,
      })
      return groupId
    },

    async endSession(groupId) {
      const tabs = await chromeApi.tabs.query({ groupId })
      const tabIds = tabs
        .map((tab) => tab.id)
        .filter((id): id is number => typeof id === 'number')
      if (tabIds.length === 0) {
        return
      }
      await chromeApi.tabs.ungroup(tabIds)
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
      const tab = await chromeApi.tabs.get(tabId)
      if (!isAllowedWorkspaceUrl(tab.url ?? tab.pendingUrl ?? '')) {
        throw new Error('Only http(s) tabs can join the AgentWorkspace')
      }
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
      const trimmed = query.trim()
      if (!trimmed) {
        throw new Error('searchWeb requires a non-empty query')
      }

      try {
        const { url, parsed } = await fetchDuckDuckGoSerp(trimmed, {
          fetchImpl: options.fetchImpl,
        })
        if (parsed.mainText.trim()) {
          return {
            query: trimmed,
            url,
            mainText: parsed.mainText,
            results: parsed.results,
            mode: 'fetch',
          }
        }
      } catch {
        // Fall through to Google tab extract.
      }

      return searchViaGoogleTab(workspace, chromeApi, groupId, trimmed)
    },
  }

  return workspace
}
