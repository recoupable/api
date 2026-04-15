import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const postSegmentsBodySchema = z.object({
  prompt: z.string({ message: "prompt is required" }).min(1, "prompt cannot be empty"),
});

export type PostSegmentsBody = z.infer<typeof postSegmentsBodySchema>;

/**
 * Validates the request body for POST /api/artists/{id}/segments.
 *
 * @param body - The parsed request body to validate.
 * @returns A NextResponse with an error when validation fails, or the validated body when it passes.
 */
export function validatePostSegmentsBody(body: unknown): NextResponse | PostSegmentsBody {
  const result = postSegmentsBodySchema.safeParse(body);

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
