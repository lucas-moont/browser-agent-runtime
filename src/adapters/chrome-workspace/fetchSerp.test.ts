import { describe, expect, it } from 'vitest'
import { parseDuckDuckGoHtml, buildDuckDuckGoSearchUrl } from './fetchSerp'

describe('fetchSerp', () => {
  it('builds a DuckDuckGo HTML search URL', () => {
    expect(buildDuckDuckGoSearchUrl('agent runtime')).toContain(
      'html.duckduckgo.com/html/?q=agent%20runtime',
    )
  })

  it('parses organic results from DuckDuckGo HTML', () => {
    const html = `
      <html><body>
        <div class="result results_links results_links_deep web-result">
          <a rel="nofollow" class="result__a" href="https://duckduckgo.com/l/?uddg=${encodeURIComponent('https://example.com/one')}">First Result</a>
          <a class="result__snippet">First snippet about agents.</a>
        </div>
        <div class="result results_links">
          <a class="result__a" href="https://example.com/two">Second Result</a>
          <a class="result__snippet">Second snippet.</a>
        </div>
      </body></html>
    `
    const parsed = parseDuckDuckGoHtml(html)
    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0]).toMatchObject({
      title: 'First Result',
      url: 'https://example.com/one',
      snippet: 'First snippet about agents.',
    })
    expect(parsed.mainText).toContain('1. First Result')
    expect(parsed.mainText).toContain('https://example.com/one')
    expect(parsed.mainText).toContain('2. Second Result')
  })

  it('returns empty when HTML has no result blocks', () => {
    expect(parseDuckDuckGoHtml('<html><body>captcha</body></html>')).toEqual({
      results: [],
      mainText: '',
    })
  })
})
