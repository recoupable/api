import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const updatePulseBodySchema = z.object({
  active: z.boolean({ message: "active must be a boolean" }),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type UpdatePulseBody = z.infer<typeof updatePulseBodySchema>;

/**
 * Validates request body for PATCH /api/pulse.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateUpdatePulseBody(body: unknown): NextResponse | UpdatePulseBody {
  const result = updatePulseBodySchema.safeParse(body);

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
