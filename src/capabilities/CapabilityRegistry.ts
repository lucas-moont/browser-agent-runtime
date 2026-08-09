export const CAPABILITY_IDS = [
  'languageDetector',
  'summarizer',
  'translator',
  'prompt',
] as const

export type CapabilityId = (typeof CAPABILITY_IDS)[number]

export type CapabilityReadiness =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

export type CapabilityProbeOptions = {
  sourceLanguage?: string
  targetLanguage?: string
  outputLanguage?: string
}

export type CapabilitySnapshot = Record<CapabilityId, CapabilityReadiness>

export type CapabilitySnapshotOptions = {
  translator?: {
    sourceLanguage: string
    targetLanguage: string
  }
  outputLanguage?: string
}

export type CapabilityProbe = {
  probe(id: CapabilityId, options?: CapabilityProbeOptions): Promise<CapabilityReadiness>
}

export class UnknownCapabilityError extends Error {
  readonly capabilityId: string

  constructor(capabilityId: string) {
    super(`Unknown capability: ${capabilityId}`)
    this.name = 'UnknownCapabilityError'
    this.capabilityId = capabilityId
  }
}

const KNOWN_CAPABILITIES = new Set<string>(CAPABILITY_IDS)

function assertCapabilityId(id: string): asserts id is CapabilityId {
  if (!KNOWN_CAPABILITIES.has(id)) {
    throw new UnknownCapabilityError(id)
  }
}

export class CapabilityRegistry {
  constructor(private readonly probe: CapabilityProbe) {}

  async get(id: CapabilityId, options?: CapabilityProbeOptions): Promise<CapabilityReadiness> {
    assertCapabilityId(id)
    try {
      return await this.probe.probe(id, options)
    } catch {
      return 'unavailable'
    }
  }

  async snapshot(options?: CapabilitySnapshotOptions): Promise<CapabilitySnapshot> {
    const translatorOptions = options?.translator
    const outputLanguage =
      options?.outputLanguage ?? translatorOptions?.sourceLanguage ?? 'en'
    const foundationOptions = { outputLanguage }
    const [languageDetector, summarizer, translator, prompt] = await Promise.all([
      this.get('languageDetector'),
      this.get('summarizer', foundationOptions),
      this.get('translator', translatorOptions),
      this.get('prompt', foundationOptions),
    ])

    return {
      languageDetector,
      summarizer,
      translator,
      prompt,
    }
  }
}

export function createCapabilityRegistry(probe: CapabilityProbe): CapabilityRegistry {
  return new CapabilityRegistry(probe)
}
