import { describe, expect, it, vi } from 'vitest'
import { createChromeMessagingTransport } from './createChromeMessagingTransport'
import { wrapScriptInjectionError } from './injectErrors'

describe('wrapScriptInjectionError', () => {
  it('explains restricted chrome:// pages', () => {
    const error = wrapScriptInjectionError(
      new Error('Cannot access a chrome:// URL'),
      3,
    )
    expect(error.message).toContain('http(s)')
    expect(error.message).toContain('tab 3')
  })

  it('explains missing host permission', () => {
    const error = wrapScriptInjectionError(
      new Error('Extension manifest must request permission to access this host'),
      9,
    )
    expect(error.message).toContain('host permission')
    expect(error.message).toContain('Reload')
  })
})

describe('createChromeMessagingTransport', () => {
  it('returns extractPage.response from scripting.executeScript', async () => {
    const transport = createChromeMessagingTransport({
      scripting: {
        executeScript: vi.fn(async () => [
          {
            result: {
              title: 'Doc',
              url: 'https://example.com',
              selection: '',
              mainText: 'hello',
            },
          },
        ]),
      },
      runtime: { sendMessage: vi.fn() },
    })

    const response = await transport.sendToContentScript(1, {
      type: 'extractPage.request',
      id: 'req-1',
    })

    expect(response).toEqual({
      type: 'extractPage.response',
      id: 'req-1',
      page: {
        title: 'Doc',
        url: 'https://example.com',
        selection: '',
        mainText: 'hello',
      },
    })
  })

  it('wraps scripting failures with actionable errors', async () => {
    const transport = createChromeMessagingTransport({
      scripting: {
        executeScript: vi.fn(async () => {
          throw new Error('Cannot access a chrome:// URL')
        }),
      },
      runtime: { sendMessage: vi.fn() },
    })

    await expect(
      transport.sendToContentScript(5, { type: 'extractPage.request', id: 'x' }),
    ).rejects.toThrow(/Cannot extract this page/)
  })
})
