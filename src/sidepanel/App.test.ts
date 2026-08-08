import { describe, expect, it } from 'vitest'
import { APP_TITLE } from './App'

describe('side panel shell', () => {
  it('exposes the project title', () => {
    expect(APP_TITLE).toBe('Browser Agent Runtime')
  })
})
