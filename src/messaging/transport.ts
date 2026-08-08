import type { ContentToExtensionMessage, ExtensionToContentMessage } from './schemas'

export interface MessagingTransport {
  sendToContentScript(
    tabId: number,
    message: ExtensionToContentMessage,
  ): Promise<unknown>
  sendToExtension(message: ContentToExtensionMessage): Promise<unknown>
}
