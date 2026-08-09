import type { LanguageDetectorPort } from '../adapters/chrome-ai/ports'
import {
  preferredLanguageFromDetections,
  type PreferredLanguage,
} from './preferredLanguage'

export type DetectPreferredLanguageOptions = {
  fallback?: PreferredLanguage
  minConfidence?: number
}

/** Detect which PreferredLanguage the user is writing in (Chrome Language Detector). */
export async function detectPreferredLanguageFromText(
  text: string,
  detector: LanguageDetectorPort,
  options?: DetectPreferredLanguageOptions,
): Promise<PreferredLanguage> {
  const trimmed = text.trim()
  const fallback = options?.fallback ?? 'en'
  if (!trimmed) {
    return fallback
  }

  const detections = await detector.detect(trimmed)
  return preferredLanguageFromDetections(detections, {
    minConfidence: options?.minConfidence,
    fallback,
  })
}
