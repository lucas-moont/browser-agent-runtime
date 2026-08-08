import type { LanguageDetectorPort, CapabilityReadinessPort } from '../../adapters/chrome-ai/ports'
import type { AgentTool } from '../types'
import { ToolError } from '../types'
import { assertCapabilityAvailable } from './assertCapabilityAvailable'
import {
  detectLanguageInputSchema,
  detectLanguageOutputSchema,
  type DetectLanguageInput,
  type DetectLanguageOutput,
} from './schemas'

export type DetectLanguageToolDeps = {
  languageDetector: LanguageDetectorPort
  readiness: CapabilityReadinessPort
}

export function createDetectLanguageTool(
  deps: DetectLanguageToolDeps,
): AgentTool<DetectLanguageInput, DetectLanguageOutput> {
  return {
    name: 'detectLanguage',
    description: 'Detect the language of text using Chrome Language Detector',
    capabilities: ['languageDetector'],
    dataBoundary: 'LOCAL',
    inputSchema: detectLanguageInputSchema,
    outputSchema: detectLanguageOutputSchema,
    async execute(input) {
      await assertCapabilityAvailable(deps.readiness, 'languageDetector')

      let detections
      try {
        detections = await deps.languageDetector.detect(input.text)
      } catch (cause) {
        throw new ToolError('adapter_error', 'Language detection failed', {
          capabilityId: 'languageDetector',
          cause,
        })
      }

      const top = detections[0]
      if (!top) {
        throw new ToolError('adapter_error', 'Language detection returned no results', {
          capabilityId: 'languageDetector',
        })
      }

      return {
        language: top.detectedLanguage,
        confidence: top.confidence,
        detections,
      }
    },
  }
}
