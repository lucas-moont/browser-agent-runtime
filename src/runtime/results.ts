import { z } from 'zod'
import type { WorkflowId } from './types'

export const analyzePageResultSchema = z.strictObject({
  language: z.string().min(1),
  summary: z.string(),
  topics: z.array(z.string()),
  concepts: z.array(z.string()),
  preferredLanguage: z.string().min(1),
})

export const learningPathResultSchema = z.strictObject({
  prerequisites: z.array(z.string()),
  concepts: z.array(z.string()),
  sequence: z.array(z.string()),
  nextTopics: z.array(z.string()),
  preferredLanguage: z.string().min(1),
})

export const summarizePageResultSchema = z.strictObject({
  language: z.string().min(1),
  summary: z.string(),
  foundationLanguage: z.string().min(1),
  translatedInbound: z.boolean(),
  preferredLanguage: z.string().min(1),
})

export const conversationalResultSchema = z.strictObject({
  reply: z.string(),
  language: z.string().min(1),
  preferredLanguage: z.string().min(1),
})

export type AnalyzePageResult = z.infer<typeof analyzePageResultSchema>
export type LearningPathResult = z.infer<typeof learningPathResultSchema>
export type SummarizePageResult = z.infer<typeof summarizePageResultSchema>
export type ConversationalResult = z.infer<typeof conversationalResultSchema>

export type DemoResult =
  | AnalyzePageResult
  | LearningPathResult
  | SummarizePageResult
  | ConversationalResult

const RESULT_SCHEMAS: Record<WorkflowId, z.ZodType<DemoResult>> = {
  analyzePage: analyzePageResultSchema,
  learningPath: learningPathResultSchema,
  summarizePage: summarizePageResultSchema,
  conversational: conversationalResultSchema,
}

export function validateDemoResult(
  workflowId: WorkflowId,
  value: unknown,
): { ok: true; value: DemoResult } | { ok: false; issues: unknown } {
  const parsed = RESULT_SCHEMAS[workflowId].safeParse(value)
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues }
  }
  return { ok: true, value: parsed.data }
}
