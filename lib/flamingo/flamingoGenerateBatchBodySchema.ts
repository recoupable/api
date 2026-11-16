import { z } from "zod";

/**
 * One question about the audio. `id` is the caller's key for the answer;
 * `max_new_tokens` bounds this prompt's answer alone.
 */
const batchPromptSchema = z.object({
  id: z
    .string({ error: issue => (issue.input === undefined ? "id is required" : undefined) })
    .min(1, "id cannot be empty")
    .max(64, "id exceeds 64 character limit"),
  prompt: z
    .string({ error: issue => (issue.input === undefined ? "prompt is required" : undefined) })
    .min(1, "prompt cannot be empty")
    .max(4000, "prompt exceeds 4,000 character limit"),
  max_new_tokens: z.number().int().min(1).max(2048).optional().default(400),
});

/**
 * Zod schema for the POST /api/songs/analyze/batch body: up to 40 short
 * prompts answered on one download of `audio_url`, so the per-call base
 * price is paid once. Generation params apply to every prompt; ids must be
 * unique so each answer maps back to exactly one prompt.
 */
export const flamingoGenerateBatchBodySchema = z.object({
  audio_url: z
    .string({
      error: issue => (issue.input === undefined ? "audio_url is required" : undefined),
    })
    .url("audio_url must be a valid URL"),
  prompts: z
    .array(batchPromptSchema, {
      error: issue => (issue.input === undefined ? "prompts is required" : undefined),
    })
    .min(1, "prompts must contain at least one prompt")
    .max(40, "prompts cannot contain more than 40 prompts")
    .refine(prompts => new Set(prompts.map(p => p.id)).size === prompts.length, {
      message: "prompt ids must be unique",
    }),
  temperature: z.number().min(0).max(2).optional().default(0.2),
  top_p: z.number().min(0).max(1).optional().default(1),
  do_sample: z.boolean().optional().default(false),
});

/** Inferred TypeScript type from the Zod schema (defaults applied). */
export type FlamingoGenerateBatchBody = z.infer<typeof flamingoGenerateBatchBodySchema>;
