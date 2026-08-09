import type { CapabilityReadinessPort, TranslatorPort } from '../../adapters/chrome-ai/ports'
import type { AgentTool } from '../types'
import { ToolError } from '../types'
import { assertCapabilityAvailable } from './assertCapabilityAvailable'
import {
  translateInputSchema,
  translateOutputSchema,
  type TranslateInput,
  type TranslateOutput,
} from './schemas'

export type TranslateToolDeps = {
  translator: TranslatorPort
  readiness: CapabilityReadinessPort
}

export function createTranslateTool(deps: TranslateToolDeps): AgentTool<TranslateInput, TranslateOutput> {
  return {
    name: 'translate',
    description: 'Translate text between languages using Chrome Translator',
    capabilities: ['translator'],
    dataBoundary: 'LOCAL',
    inputSchema: translateInputSchema,
    outputSchema: translateOutputSchema,
    async execute(input, context) {
      await assertCapabilityAvailable(deps.readiness, 'translator', {
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      })

      let text
      try {
        text = await deps.translator.translate(input.text, {
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
          signal: context?.signal,
        })
      } catch (cause) {
        throw new ToolError('adapter_error', 'Translation failed', {
          capabilityId: 'translator',
          cause,
        })
      }

      return {
        text,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      }
    },
  }
}
