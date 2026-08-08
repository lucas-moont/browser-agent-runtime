import type {
  CapabilityReadinessPort,
  LanguageDetectorPort,
  PromptPort,
  SummarizerPort,
  TranslatorPort,
} from '../../adapters/chrome-ai/ports'
import type { ToolRegistry } from '../ToolRegistry'
import type { AgentTool } from '../types'
import { createDetectLanguageTool } from './detectLanguageTool'
import { createPromptTool } from './promptTool'
import { createSummarizeTool } from './summarizeTool'
import { createTranslateTool } from './translateTool'

export type BuiltinAiToolDeps = {
  languageDetector: LanguageDetectorPort
  translator: TranslatorPort
  summarizer: SummarizerPort
  prompt: PromptPort
  readiness: CapabilityReadinessPort
}

export function createBuiltinAiTools(deps: BuiltinAiToolDeps): AgentTool[] {
  return [
    createDetectLanguageTool(deps),
    createTranslateTool(deps),
    createSummarizeTool(deps),
    createPromptTool(deps),
  ]
}

export function registerBuiltinAiTools(registry: ToolRegistry, deps: BuiltinAiToolDeps): void {
  for (const tool of createBuiltinAiTools(deps)) {
    registry.register(tool)
  }
}
