export {
  AGENT_WORKSPACE_TITLE,
  AGENT_WORKSPACE_COLOR,
  isAllowedWorkspaceUrl,
  type AgentWorkspacePort,
  type WorkspaceTabInfo,
  type WebSearchResult,
  type WebSearchResultItem,
} from './types'

export {
  createChromeAgentWorkspace,
  buildWebSearchUrl,
  type ChromeWorkspaceApi,
  type CreateChromeAgentWorkspaceOptions,
} from './createChromeAgentWorkspace'

export {
  buildDuckDuckGoSearchUrl,
  parseDuckDuckGoHtml,
  fetchDuckDuckGoSerp,
  type SerpResult,
  type ParsedSerp,
} from './fetchSerp'
