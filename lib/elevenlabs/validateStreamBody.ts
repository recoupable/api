import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { musicGenerationBaseFields, promptOrPlanRefinements } from "./schemas";

export const streamBodySchema = z
  .object({
    ...musicGenerationBaseFields,
  })
  .refine(promptOrPlanRefinements[0].check, { message: promptOrPlanRefinements[0].message })
  .refine(promptOrPlanRefinements[1].check, { message: promptOrPlanRefinements[1].message });

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
