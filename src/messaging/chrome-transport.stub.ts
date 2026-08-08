import type { MessagingTransport } from './transport'

export function createChromeMessagingTransportStub(): MessagingTransport {
  return {
    async sendToContentScript() {
      throw new Error(
        'ChromeMessagingTransport not implemented: wire tabs.sendMessage for extension→content-script',
      )
    },
    async sendToExtension() {
      throw new Error(
        'ChromeMessagingTransport not implemented: wire runtime.sendMessage for content-script→extension',
      )
    },
  }
}
