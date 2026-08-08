import { describe, expect, it, vi } from 'vitest'
import {
  decodeInboundFromContentScript,
  encodeOutboundToContentScript,
  encodeMessage,
  decodeMessage,
  createMessageRouter,
  createFakeMessagingTransport,
  createChromeMessagingTransportStub,
  type ExtensionToContentMessage,
  type ContentToExtensionMessage,
  type MessagingTransport,
} from './index'

const extractRequest: ExtensionToContentMessage = {
  type: 'extractPage.request',
  id: 'req-1',
}

const extractResponse: ContentToExtensionMessage = {
  type: 'extractPage.response',
  id: 'req-1',
  page: {
    title: 'Example',
    url: 'https://example.com/',
    selection: 'hello',
    mainText: 'hello world',
  },
}

const inspectRequest: ExtensionToContentMessage = {
  type: 'inspectPageContext.request',
  id: 'req-2',
}

const inspectResponse: ContentToExtensionMessage = {
  type: 'inspectPageContext.response',
  id: 'req-2',
  context: {
    title: 'Example',
    url: 'https://example.com/',
    hasSelection: true,
    selectionLength: 5,
    mainTextLength: 11,
  },
}

describe('Messaging seam — codec', () => {
  it('round-trips a valid extractPage request/response through encode/decode', () => {
    const encodedRequest = encodeMessage(extractRequest)
    expect(encodedRequest.ok).toBe(true)
    if (!encodedRequest.ok) return

    const decodedRequest = decodeMessage(encodedRequest.value)
    expect(decodedRequest).toEqual({ ok: true, value: extractRequest })

    const encodedResponse = encodeMessage(extractResponse)
    expect(encodedResponse.ok).toBe(true)
    if (!encodedResponse.ok) return

    const decodedResponse = decodeMessage(JSON.parse(JSON.stringify(encodedResponse.value)))
    expect(decodedResponse).toEqual({ ok: true, value: extractResponse })
  })

  it('round-trips a valid inspectPageContext request/response', () => {
    const encodedRequest = encodeOutboundToContentScript(inspectRequest)
    expect(encodedRequest.ok).toBe(true)

    const encodedResponse = encodeMessage(inspectResponse)
    expect(encodedResponse.ok).toBe(true)
    if (!encodedResponse.ok) return

    const inbound = decodeInboundFromContentScript(
      JSON.parse(JSON.stringify(encodedResponse.value)),
    )
    expect(inbound).toEqual({ ok: true, value: inspectResponse })
  })

  it('rejects non-JSON-serializable payloads on encode', () => {
    const withFn = {
      type: 'extractPage.request',
      id: 'req-x',
      boom: () => 'nope',
    }
    const result = encodeMessage(withFn as unknown as ExtensionToContentMessage)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('not_serializable')
  })
})

describe('Messaging seam — content-script inbound validation', () => {
  it('rejects malformed CS payloads and does not invoke the handler', async () => {
    const handler = vi.fn()
    const router = createMessageRouter({
      onContentToExtension: handler,
    })

    const malformed = {
      type: 'extractPage.response',
      id: 'req-1',
      page: {
        title: 'Example',
        url: 'https://example.com/',
        selection: 123,
        mainText: 'x',
      },
    }

    const result = await router.handleInboundFromContentScript(malformed)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('schema')
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects disallowed CS→extension message types', async () => {
    const handler = vi.fn()
    const router = createMessageRouter({
      onContentToExtension: handler,
    })

    const result = await router.handleInboundFromContentScript({
      type: 'extractPage.request',
      id: 'attacker-1',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('disallowed_type')
    expect(handler).not.toHaveBeenCalled()
  })

  it('routes allowlisted CS messages to the handler', async () => {
    const handler = vi.fn(async (message: ContentToExtensionMessage) => ({
      acknowledged: message.id,
    }))
    const router = createMessageRouter({
      onContentToExtension: handler,
    })

    const result = await router.handleInboundFromContentScript(extractResponse)
    expect(result).toEqual({ ok: true, value: { acknowledged: 'req-1' } })
    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(extractResponse)
  })
})

describe('Messaging seam — outbound privilege', () => {
  it('forbids sensitive fields on messages sent to the content script', () => {
    const privileged = {
      type: 'extractPage.request',
      id: 'req-1',
      apiKey: 'super-secret',
    }

    const result = encodeOutboundToContentScript(privileged)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('privilege')
  })
})

describe('Messaging seam — fake transport round-trip', () => {
  it('delivers extractPage through codec + router with a fake transport', async () => {
    const transport = createFakeMessagingTransport({
      async onExtensionToContent(message) {
        expect(message.type).toBe('extractPage.request')
        return {
          type: 'extractPage.response',
          id: message.id,
          page: {
            title: 'Doc',
            url: 'https://docs.example/',
            selection: '',
            mainText: 'body',
          },
        }
      },
    })

    const encoded = encodeOutboundToContentScript(extractRequest)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return

    const rawResponse = await transport.sendToContentScript(42, encoded.value)
    const decoded = decodeInboundFromContentScript(rawResponse)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.value).toEqual({
      type: 'extractPage.response',
      id: 'req-1',
      page: {
        title: 'Doc',
        url: 'https://docs.example/',
        selection: '',
        mainText: 'body',
      },
    })
  })

  it('exposes a Chrome transport adapter interface with a stub implementation', async () => {
    const stub: MessagingTransport = createChromeMessagingTransportStub()
    await expect(stub.sendToContentScript(1, extractRequest)).rejects.toThrow(
      /not implemented/i,
    )
    await expect(stub.sendToExtension(extractResponse)).rejects.toThrow(/not implemented/i)
  })
})
