import { decodeInboundFromContentScript, decodeOutboundToContentScript } from './codec'
import { err, ok, type MessagingResult } from './result'
import type { ContentToExtensionMessage, ExtensionToContentMessage } from './schemas'

export type ContentToExtensionHandler<T = unknown> = (
  message: ContentToExtensionMessage,
) => T | Promise<T>

export type ExtensionToContentHandler<T = unknown> = (
  message: ExtensionToContentMessage,
) => T | Promise<T>

export type MessageRouterOptions = {
  onContentToExtension?: ContentToExtensionHandler
  onExtensionToContent?: ExtensionToContentHandler
}

export type MessageRouter = {
  handleInboundFromContentScript(input: unknown): Promise<MessagingResult<unknown>>
  handleOutboundToContentScript(input: unknown): Promise<MessagingResult<unknown>>
}

export function createMessageRouter(options: MessageRouterOptions = {}): MessageRouter {
  return {
    async handleInboundFromContentScript(input: unknown): Promise<MessagingResult<unknown>> {
      const decoded = decodeInboundFromContentScript(input)
      if (!decoded.ok) {
        return decoded
      }
      if (!options.onContentToExtension) {
        return err({
          kind: 'schema',
          message: 'No content-script inbound handler registered',
        })
      }
      const value = await options.onContentToExtension(decoded.value)
      return ok(value)
    },

    async handleOutboundToContentScript(input: unknown): Promise<MessagingResult<unknown>> {
      const decoded = decodeOutboundToContentScript(input)
      if (!decoded.ok) {
        return decoded
      }
      if (!options.onExtensionToContent) {
        return err({
          kind: 'schema',
          message: 'No extension→content-script handler registered',
        })
      }
      const value = await options.onExtensionToContent(decoded.value)
      return ok(value)
    },
  }
}
