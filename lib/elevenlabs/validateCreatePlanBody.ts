import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { compositionPlanSchema } from "./compositionPlanSchema";

export const createPlanBodySchema = z.object({
  prompt: z.string().max(4100, "prompt exceeds 4100 character limit"),
  music_length_ms: z.number().int().min(3000).max(600000).nullable().optional(),
  source_composition_plan: compositionPlanSchema.nullable().optional(),
  model_id: z.enum(["music_v1"]).optional().default("music_v1"),
});

export type CreatePlanBody = z.infer<typeof createPlanBodySchema>;

/**
 * Validates the request body for POST /api/music/plan.
 *
 * @param body - The raw request body.
 * @returns Validated data or a NextResponse error.
 */
export function validateCreatePlanBody(body: unknown): NextResponse | CreatePlanBody {
  const result = createPlanBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
