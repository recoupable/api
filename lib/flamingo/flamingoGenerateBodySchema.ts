import { z } from "zod";
import { PRESET_NAMES } from "@/lib/flamingo/presets";

/**
 * Zod schema for the POST /api/songs/analyze body, shared with the
 * `analyze_music` MCP tool's input schema.
 *
 * Callers must provide either a "preset" name OR a custom "prompt" — not both —
 * and always an "audio_url": the model is only useful with audio, and a
 * text-only call still starts a GPU container (recoupable/app#2061).
 * When using a preset, the prompt and generation params are resolved automatically.
 */
export const flamingoGenerateBodySchema = z
  .object({
    preset: z.enum(PRESET_NAMES as unknown as [string, ...string[]]).optional(),
    prompt: z
      .string()
      .min(1, "prompt cannot be empty")
      .max(24000, "prompt exceeds 24,000 character limit")
      .optional(),
    audio_url: z
      .string({
        error: issue => (issue.input === undefined ? "audio_url is required" : undefined),
      })
      .url("audio_url must be a valid URL"),
    max_new_tokens: z.number().int().min(1).max(2048).optional().default(512),
    temperature: z.number().min(0).max(2).optional().default(1.0),
    top_p: z.number().min(0).max(1).optional().default(1.0),
    do_sample: z.boolean().optional().default(false),
  })
  .refine(data => data.preset || data.prompt, {
    message: "Either 'preset' or 'prompt' is required",
    path: ["preset"],
  })
  .refine(data => !(data.preset && data.prompt), {
    message: "Provide either 'preset' or 'prompt', not both",
    path: ["prompt"],
  });

/** Inferred TypeScript type from the Zod schema. */
export type FlamingoGenerateBody = z.infer<typeof flamingoGenerateBodySchema>;
