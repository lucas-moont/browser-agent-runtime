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
import { parseStructuredJson } from './parseStructuredJson'
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

function isReplyShapedConstraint(constraint: Record<string, unknown>): boolean {
  const required = constraint.required
  if (Array.isArray(required) && required.includes('reply')) {
    return true
  }
  const properties = constraint.properties
  return (
    typeof properties === 'object' &&
    properties !== null &&
    'reply' in properties
  )
}

function isQueryShapedConstraint(constraint: Record<string, unknown>): boolean {
  const required = constraint.required
  if (Array.isArray(required) && required.includes('query')) {
    return true
  }
  const properties = constraint.properties
  return (
    typeof properties === 'object' &&
    properties !== null &&
    'query' in properties
  )
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
    async execute(input, context) {
      await assertCapabilityAvailable(deps.readiness, 'prompt', {
        outputLanguage: DEFAULT_FOUNDATION_LANGUAGE,
      })

      const sourceLanguage = await resolveSourceLanguage(input.text, input.sourceLanguage, deps)

      const normalized = await normalizeToFoundationLanguage(input.text, sourceLanguage, {
        targetFoundationLanguage: DEFAULT_FOUNDATION_LANGUAGE,
        translate: async (text, options) => {
          await assertCapabilityAvailable(deps.readiness, 'translator', options)
          return deps.translator.translate(text, { ...options, signal: context?.signal })
        },
      })

      let text
      try {
        text = await deps.prompt.prompt(normalized.text, {
          responseConstraint: input.responseConstraint,
          omitResponseConstraintInput: input.omitResponseConstraintInput,
          signal: context?.signal,
          outputLanguage: normalized.foundationLanguage,
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
          structured = parseStructuredJson(text)
        } catch (cause) {
          if (isReplyShapedConstraint(input.responseConstraint) && text.trim()) {
            structured = { reply: text.trim() }
          } else if (isQueryShapedConstraint(input.responseConstraint)) {
            const candidate = text.trim().replace(/^["']|["']$/g, '')
            structured = {
              query:
                candidate && !candidate.includes('\n') && candidate.length <= 120
                  ? candidate
                  : '',
            }
          } else {
            throw new ToolError('validation', 'Prompt structured output is not valid JSON', {
              capabilityId: 'prompt',
              cause,
            })
          }
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
