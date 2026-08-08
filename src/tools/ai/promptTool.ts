import type {
  CapabilityReadinessPort,
  LanguageDetectorPort,
  PromptPort,
  TranslatorPort,
} from '../../adapters/chrome-ai/ports'
import {
  DEFAULT_FOUNDATION_LANGUAGE,
  normalizeToFoundationLanguage,
  primaryLanguageTag,
} from '../../runtime/foundationLanguage'
import type { AgentTool } from '../types'
import { ToolError } from '../types'
import { assertCapabilityAvailable } from './assertCapabilityAvailable'
import {
  promptInputSchema,
  promptOutputSchema,
  type PromptInput,
  type PromptOutput,
} from './schemas'

export type PromptToolDeps = {
  prompt: PromptPort
  translator: TranslatorPort
  languageDetector: LanguageDetectorPort
  readiness: CapabilityReadinessPort
}

async function resolveSourceLanguage(
  text: string,
  sourceLanguage: string | undefined,
  deps: PromptToolDeps,
): Promise<string> {
  if (sourceLanguage) {
    return primaryLanguageTag(sourceLanguage)
  }

  await assertCapabilityAvailable(deps.readiness, 'languageDetector')
  const detections = await deps.languageDetector.detect(text)
  const top = detections[0]
  if (!top) {
    throw new ToolError('adapter_error', 'Language detection returned no results', {
      capabilityId: 'languageDetector',
    })
  }
  return primaryLanguageTag(top.detectedLanguage)
}

export function createPromptTool(deps: PromptToolDeps): AgentTool<PromptInput, PromptOutput> {
  return {
    name: 'prompt',
    description: 'Run Chrome Prompt API with optional responseConstraint structured output',
    capabilities: ['prompt'],
    dataBoundary: 'LOCAL',
    inputSchema: promptInputSchema,
    outputSchema: promptOutputSchema,
    async execute(input) {
      await assertCapabilityAvailable(deps.readiness, 'prompt')

      const sourceLanguage = await resolveSourceLanguage(input.text, input.sourceLanguage, deps)

      const normalized = await normalizeToFoundationLanguage(input.text, sourceLanguage, {
        targetFoundationLanguage: DEFAULT_FOUNDATION_LANGUAGE,
        translate: async (text, options) => {
          await assertCapabilityAvailable(deps.readiness, 'translator', options)
          return deps.translator.translate(text, options)
        },
      })

      let text
      try {
        text = await deps.prompt.prompt(normalized.text, {
          responseConstraint: input.responseConstraint,
          omitResponseConstraintInput: input.omitResponseConstraintInput,
        })
      } catch (cause) {
        throw new ToolError('adapter_error', 'Prompt failed', {
          capabilityId: 'prompt',
          cause,
        })
      }

      let structured: unknown | undefined
      if (input.responseConstraint !== undefined) {
        try {
          structured = JSON.parse(text) as unknown
        } catch (cause) {
          throw new ToolError('validation', 'Prompt structured output is not valid JSON', {
            capabilityId: 'prompt',
            cause,
          })
        }
      }

      return {
        text,
        structured,
        sourceLanguage: normalized.sourceLanguage,
        foundationLanguage: normalized.foundationLanguage,
        translatedInbound: normalized.translatedInbound,
      }
    },
  }
}
