import type {
  ContentToExtensionMessage,
  MessagingTransport,
  PageContextInspection,
  PageSnapshot,
} from '../../messaging'
import { wrapScriptInjectionError } from './injectErrors'
import { extractPageSnapshotInPage, inspectPageContextInPage } from './pageDom'

export type ChromeMessagingApi = {
  scripting: {
    executeScript(injection: {
      target: { tabId: number }
      func: () => unknown
    }): Promise<Array<{ result?: unknown }>>
  }
  runtime: {
    sendMessage(message: unknown): Promise<unknown>
  }
}

function readInjectionResult(results: Array<{ result?: unknown }> | undefined): unknown {
  const first = results?.[0]
  if (!first || first.result === undefined) {
    throw new Error('Chrome scripting.executeScript returned no result')
  }
  return first.result
}

export function createChromeMessagingTransport(
  chromeApi: ChromeMessagingApi = chrome as unknown as ChromeMessagingApi,
): MessagingTransport {
  return {
    async sendToContentScript(tabId, message) {
      try {
        if (message.type === 'extractPage.request') {
          const results = await chromeApi.scripting.executeScript({
            target: { tabId },
            func: extractPageSnapshotInPage,
          })
          const page = readInjectionResult(results) as PageSnapshot
          const response: ContentToExtensionMessage = {
            type: 'extractPage.response',
            id: message.id,
            page,
          }
          return response
        }

        if (message.type === 'inspectPageContext.request') {
          const results = await chromeApi.scripting.executeScript({
            target: { tabId },
            func: inspectPageContextInPage,
          })
          const context = readInjectionResult(results) as PageContextInspection
          const response: ContentToExtensionMessage = {
            type: 'inspectPageContext.response',
            id: message.id,
            context,
          }
          return response
        }
      } catch (cause) {
        throw wrapScriptInjectionError(cause, tabId)
      }

      throw new Error(`Unsupported extension→content message type`)
    },

    async sendToExtension(message: ContentToExtensionMessage) {
      return chromeApi.runtime.sendMessage(message)
    },
  }
}

export async function resolveActiveTabId(
  queryTabs: (
    query: chrome.tabs.QueryInfo,
  ) => Promise<chrome.tabs.Tab[]> = (query) => chrome.tabs.query(query),
): Promise<number> {
  const tabs = await queryTabs({ active: true, currentWindow: true })
  const tabId = tabs[0]?.id
  if (typeof tabId !== 'number') {
    throw new Error('No active tab available')
  }
  return tabId
}
