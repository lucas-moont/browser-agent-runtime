import { z } from 'zod'
import type { WorkflowId } from './types'

export const analyzePageResultSchema = z.strictObject({
  language: z.string().min(1),
  summary: z.string(),
  topics: z.array(z.string()),
  concepts: z.array(z.string()),
})

export const learningPathResultSchema = z.strictObject({
  prerequisites: z.array(z.string()),
  concepts: z.array(z.string()),
  sequence: z.array(z.string()),
  nextTopics: z.array(z.string()),
})

export const summarizeInPortugueseResultSchema = z.strictObject({
  language: z.string().min(1),
  summaryPt: z.string(),
  foundationLanguage: z.string().min(1),
  translatedInbound: z.boolean(),
})

export type AnalyzePageResult = z.infer<typeof analyzePageResultSchema>
export type LearningPathResult = z.infer<typeof learningPathResultSchema>
export type SummarizeInPortugueseResult = z.infer<typeof summarizeInPortugueseResultSchema>

export type DemoResult =
  | AnalyzePageResult
  | LearningPathResult
  | SummarizeInPortugueseResult

const RESULT_SCHEMAS: Record<WorkflowId, z.ZodType<DemoResult>> = {
  analyzePage: analyzePageResultSchema,
  learningPath: learningPathResultSchema,
  summarizeInPortuguese: summarizeInPortugueseResultSchema,
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
