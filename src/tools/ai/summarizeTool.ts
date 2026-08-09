import type {
  CapabilityReadinessPort,
  LanguageDetectorPort,
  SummarizerPort,
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
  summarizeInputSchema,
  summarizeOutputSchema,
  type SummarizeInput,
  type SummarizeOutput,
} from './schemas'

export type SummarizeToolDeps = {
  summarizer: SummarizerPort
  translator: TranslatorPort
  languageDetector: LanguageDetectorPort
  readiness: CapabilityReadinessPort
}

async function resolveSourceLanguage(
  text: string,
  sourceLanguage: string | undefined,
  deps: SummarizeToolDeps,
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

export function createSummarizeTool(deps: SummarizeToolDeps): AgentTool<SummarizeInput, SummarizeOutput> {
  return {
    name: 'summarize',
    description: 'Summarize text via Chrome Summarizer after FoundationLanguage normalization',
    capabilities: ['summarizer'],
    dataBoundary: 'LOCAL',
    inputSchema: summarizeInputSchema,
    outputSchema: summarizeOutputSchema,
    async execute(input, context) {
      const sourceLanguage = await resolveSourceLanguage(input.text, input.sourceLanguage, deps)
      const targetFoundation = input.outputLanguage ?? DEFAULT_FOUNDATION_LANGUAGE

      await assertCapabilityAvailable(deps.readiness, 'summarizer', {
        outputLanguage: targetFoundation,
      })

      const normalized = await normalizeToFoundationLanguage(input.text, sourceLanguage, {
        targetFoundationLanguage: targetFoundation,
        translate: async (text, options) => {
          await assertCapabilityAvailable(deps.readiness, 'translator', options)
          return deps.translator.translate(text, { ...options, signal: context?.signal })
        },
      })

      let summary
      try {
        summary = await deps.summarizer.summarize(normalized.text, {
          type: input.type,
          length: input.length,
          format: input.format,
          outputLanguage: normalized.foundationLanguage,
          expectedInputLanguages: [normalized.foundationLanguage],
          signal: context?.signal,
        })
      } catch (cause) {
        throw new ToolError('adapter_error', 'Summarization failed', {
          capabilityId: 'summarizer',
          cause,
        })
      }

      return {
        summary,
        sourceLanguage: normalized.sourceLanguage,
        foundationLanguage: normalized.foundationLanguage,
        translatedInbound: normalized.translatedInbound,
      }
    },
  }
}
