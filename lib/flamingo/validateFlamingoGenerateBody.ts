import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { PRESET_NAMES } from "@/lib/flamingo/presets";

/**
 * Zod schema for the POST /api/music/analyze request body.
 *
 * Callers must provide either a "preset" name OR a custom "prompt" — not both.
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
    audio_url: z.string().url("audio_url must be a valid URL").optional(),
    max_new_tokens: z.number().int().min(1).max(2048).default(512).optional(),
    temperature: z.number().min(0).max(2).default(1.0).optional(),
    top_p: z.number().min(0).max(1).default(1.0).optional(),
    do_sample: z.boolean().default(false).optional(),
  })
  .refine((data) => data.preset || data.prompt, {
    message: "Either 'preset' or 'prompt' is required",
    path: ["preset"],
  })
  .refine((data) => !(data.preset && data.prompt), {
    message: "Provide either 'preset' or 'prompt', not both",
    path: ["prompt"],
  });

/** Inferred TypeScript type from the Zod schema. */
export type FlamingoGenerateBody = z.infer<typeof flamingoGenerateBodySchema>;

/**
 * Validates the request body for POST /api/music/analyze.
 *
 * @param body - The raw request body (parsed JSON).
 * @returns A NextResponse with an error if validation fails, or the validated body if it passes.
 */
export function validateFlamingoGenerateBody(
  body: unknown,
): NextResponse | FlamingoGenerateBody {
  const result = flamingoGenerateBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
