import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";
import { musicGenerationBaseFields, promptOrPlanRefinements } from "./schemas";

export const composeBodySchema = z
  .object({
    ...musicGenerationBaseFields,
    respect_sections_durations: z.boolean().optional().default(true),
    sign_with_c2pa: z.boolean().optional().default(false),
  })
  .refine(promptOrPlanRefinements[0].check, { message: promptOrPlanRefinements[0].message })
  .refine(promptOrPlanRefinements[1].check, { message: promptOrPlanRefinements[1].message });

export type ComposeBody = z.infer<typeof composeBodySchema>;

/**
 * Validates the request body for POST /api/music/compose.
 *
 * @param body - The raw request body.
 * @returns Validated data or a NextResponse error.
 */
export function validateComposeBody(body: unknown): NextResponse | ComposeBody {
  const result = composeBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", missing_fields: firstError.path, error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
