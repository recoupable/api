import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { compositionPlanSchema } from "./compositionPlanSchema";
import { elevenLabsOutputFormatSchema } from "./outputFormats";

export const streamBodySchema = z
  .object({
    prompt: z.string().max(4100).nullable().optional(),
    composition_plan: compositionPlanSchema.nullable().optional(),
    music_length_ms: z.number().int().min(3000).max(600000).nullable().optional(),
    model_id: z.enum(["music_v1"]).optional().default("music_v1"),
    seed: z.number().int().min(0).max(2147483647).nullable().optional(),
    force_instrumental: z.boolean().optional().default(false),
    store_for_inpainting: z.boolean().optional().default(false),
    output_format: elevenLabsOutputFormatSchema.optional(),
  })
  .refine((data) => !(data.prompt && data.composition_plan), {
    message: "Cannot use both prompt and composition_plan",
  })
  .refine((data) => data.prompt || data.composition_plan, {
    message: "Must provide either prompt or composition_plan",
  });

export type StreamBody = z.infer<typeof streamBodySchema>;

/**
 * Validates the request body for POST /api/music/stream.
 *
 * @param body - The raw request body.
 * @returns Validated data or a NextResponse error.
 */
export function validateStreamBody(body: unknown): NextResponse | StreamBody {
  const result = streamBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
