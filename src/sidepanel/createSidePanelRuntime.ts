import {
  createChromeLanguageDetectorAdapter,
  createChromePromptAdapter,
  createChromeSummarizerAdapter,
  createChromeTranslatorAdapter,
} from '../adapters/chrome-ai/sessionAdapters'
import { createChromeAiCapabilityProbe } from '../adapters/chrome-ai/createChromeAiCapabilityProbe'
import { createChromeMessagingTransport } from '../adapters/chrome-messaging'
import {
  createChromeAgentWorkspace,
  type AgentWorkspacePort,
} from '../adapters/chrome-workspace'
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

export function createSidePanelWorkspace(
  workspace: AgentWorkspacePort = createChromeAgentWorkspace(),
): AgentWorkspacePort {
  return workspace
}

export function createSidePanelRuntime(
  capabilities: CapabilityRegistry = createSidePanelCapabilityRegistry(),
  workspace: AgentWorkspacePort = createChromeAgentWorkspace(),
): AgentRuntime {
  const tools = createToolRegistry()
  registerPageTools(tools, {
    transport: createChromeMessagingTransport(),
    workspace,
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
