import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const updateAutoRechargeBodySchema = z.object({
  enabled: z.boolean({ message: "enabled must be a boolean" }),
});

export type UpdateAutoRechargeBody = z.infer<typeof updateAutoRechargeBodySchema>;

/**
 * Validates the request body for PATCH /api/accounts/{id}/auto-recharge.
 *
 * @param body - The parsed request body
 * @returns A 400 NextResponse when validation fails, or the validated body.
 */
export function validateUpdateAutoRechargeBody(
  body: unknown,
): NextResponse | UpdateAutoRechargeBody {
  const result = updateAutoRechargeBodySchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
