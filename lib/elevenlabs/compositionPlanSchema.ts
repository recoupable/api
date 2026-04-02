import { z } from "zod";

/** Zod schema for an ElevenLabs composition plan, shared across compose/stream/detailed/plan endpoints. */
export const compositionPlanSchema = z.object({
  positive_global_styles: z.array(z.string()),
  negative_global_styles: z.array(z.string()),
  sections: z.array(
    z.object({
      title: z.string(),
      lyrics: z.string().nullable().optional(),
      duration_ms: z.number().int().min(3000).max(600000).optional(),
      positive_styles: z.array(z.string()).optional(),
      negative_styles: z.array(z.string()).optional(),
      audio_url: z.string().url().nullable().optional(),
    }),
  ),
});

export type CompositionPlan = z.infer<typeof compositionPlanSchema>;
