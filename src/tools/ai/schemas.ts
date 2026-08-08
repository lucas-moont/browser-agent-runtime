import { z } from 'zod'
import { FOUNDATION_LANGUAGES } from '../../runtime/foundationLanguage'

export const foundationLanguageSchema = z.enum(FOUNDATION_LANGUAGES)

export const detectLanguageInputSchema = z.strictObject({
  text: z.string().min(1),
})

export const detectLanguageOutputSchema = z.strictObject({
  language: z.string().min(1),
  confidence: z.number().min(0).max(1),
  detections: z.array(
    z.strictObject({
      detectedLanguage: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

export const translateInputSchema = z.strictObject({
  text: z.string().min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
})

export const translateOutputSchema = z.strictObject({
  text: z.string(),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
})

export const summarizeInputSchema = z.strictObject({
  text: z.string().min(1),
  sourceLanguage: z.string().min(1).optional(),
  type: z.enum(['key-points', 'tldr', 'teaser', 'headline']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  format: z.enum(['markdown', 'plain-text']).optional(),
  outputLanguage: foundationLanguageSchema.optional(),
})

export const summarizeOutputSchema = z.strictObject({
  summary: z.string(),
  sourceLanguage: z.string().min(1),
  foundationLanguage: foundationLanguageSchema,
  translatedInbound: z.boolean(),
})

export const promptInputSchema = z.strictObject({
  text: z.string().min(1),
  sourceLanguage: z.string().min(1).optional(),
  responseConstraint: z.record(z.string(), z.unknown()).optional(),
  omitResponseConstraintInput: z.boolean().optional(),
})

export const promptOutputSchema = z.strictObject({
  text: z.string(),
  structured: z.unknown().optional(),
  sourceLanguage: z.string().min(1),
  foundationLanguage: foundationLanguageSchema,
  translatedInbound: z.boolean(),
})

export type DetectLanguageInput = z.infer<typeof detectLanguageInputSchema>
export type DetectLanguageOutput = z.infer<typeof detectLanguageOutputSchema>
export type TranslateInput = z.infer<typeof translateInputSchema>
export type TranslateOutput = z.infer<typeof translateOutputSchema>
export type SummarizeInput = z.infer<typeof summarizeInputSchema>
export type SummarizeOutput = z.infer<typeof summarizeOutputSchema>
export type PromptInput = z.infer<typeof promptInputSchema>
export type PromptOutput = z.infer<typeof promptOutputSchema>
