import { createChromeLanguageDetectorAdapter } from '../adapters/chrome-ai/sessionAdapters'
import {
  detectPreferredLanguageFromText,
  type DetectPreferredLanguageOptions,
} from '../runtime/detectPreferredLanguage'
import type { PreferredLanguage } from '../runtime/preferredLanguage'

/** Side-panel helper: detect PreferredLanguage from user message text. */
export async function detectMessagePreferredLanguage(
  text: string,
  options?: DetectPreferredLanguageOptions,
): Promise<PreferredLanguage> {
  return detectPreferredLanguageFromText(
    text,
    createChromeLanguageDetectorAdapter(),
    options,
  )
}
