import {
  createChromeLanguageDetectorAdapter,
  createChromePromptAdapter,
  createChromeSummarizerAdapter,
  createChromeTranslatorAdapter,
} from '../adapters/chrome-ai/sessionAdapters'
import { createChromeAiCapabilityProbe } from '../adapters/chrome-ai/createChromeAiCapabilityProbe'
import { createChromeMessagingTransport } from '../adapters/chrome-messaging'
import {
  createCapabilityRegistry,
  type CapabilityRegistry,
} from '../capabilities/CapabilityRegistry'
import {
  createAgentRuntime,
  type AgentRuntime,
} from '../runtime'
import {
  createToolRegistry,
  registerBuiltinAiTools,
  registerPageTools,
} from '../tools'

export function createSidePanelCapabilityRegistry(): CapabilityRegistry {
  return createCapabilityRegistry(createChromeAiCapabilityProbe())
}

export function createSidePanelRuntime(
  capabilities: CapabilityRegistry = createSidePanelCapabilityRegistry(),
): AgentRuntime {
  const tools = createToolRegistry()
  registerPageTools(tools, {
    transport: createChromeMessagingTransport(),
  })
  registerBuiltinAiTools(tools, {
    languageDetector: createChromeLanguageDetectorAdapter(),
    translator: createChromeTranslatorAdapter(),
    summarizer: createChromeSummarizerAdapter(),
    prompt: createChromePromptAdapter(),
    readiness: {
      getReadiness: (id, options) => capabilities.get(id, options),
    },
  })

  return createAgentRuntime({
    capabilities,
    tools,
  })
}
