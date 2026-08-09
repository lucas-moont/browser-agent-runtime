import type { CapabilityId } from '../../capabilities/CapabilityRegistry'
import type { CapabilityReadinessPort } from '../../adapters/chrome-ai/ports'
import { ToolError } from '../types'

export async function assertCapabilityAvailable(
  readiness: CapabilityReadinessPort,
  capabilityId: CapabilityId,
  options?: { sourceLanguage?: string; targetLanguage?: string; outputLanguage?: string },
): Promise<void> {
  const status = await readiness.getReadiness(capabilityId, options)
  if (status !== 'available') {
    throw new ToolError(
      'capability_unavailable',
      `Capability ${capabilityId} is ${status}`,
      { capabilityId },
    )
  }
}
