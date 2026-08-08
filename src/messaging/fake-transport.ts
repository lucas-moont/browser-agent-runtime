import type { ContentToExtensionMessage, ExtensionToContentMessage } from './schemas'
import type { MessagingTransport } from './transport'

export type FakeMessagingTransportOptions = {
  onExtensionToContent?: (
    message: ExtensionToContentMessage,
    tabId: number,
  ) => ContentToExtensionMessage | Promise<ContentToExtensionMessage>
  onContentToExtension?: (
    message: ContentToExtensionMessage,
  ) => unknown | Promise<unknown>
}

export type FakeMessagingTransport = MessagingTransport & {
  readonly sentToContentScript: Array<{ tabId: number; message: ExtensionToContentMessage }>
  readonly sentToExtension: ContentToExtensionMessage[]
}

export function createFakeMessagingTransport(
  options: FakeMessagingTransportOptions = {},
): FakeMessagingTransport {
  const sentToContentScript: Array<{ tabId: number; message: ExtensionToContentMessage }> = []
  const sentToExtension: ContentToExtensionMessage[] = []

  return {
    sentToContentScript,
    sentToExtension,
    async sendToContentScript(tabId, message) {
      sentToContentScript.push({ tabId, message })
      if (!options.onExtensionToContent) {
        throw new Error('FakeMessagingTransport: onExtensionToContent is not configured')
      }
      return options.onExtensionToContent(message, tabId)
    },
    async sendToExtension(message) {
      sentToExtension.push(message)
      if (!options.onContentToExtension) {
        return undefined
      }
      return options.onContentToExtension(message)
    },
  }
}
