import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAutoRechargeParams } from "@/lib/billing/validateAutoRechargeParams";

export const updateAutoRechargeBodySchema = z.object({
  enabled: z.boolean({ message: "enabled must be a boolean" }),
});

export type ValidatedUpdateAutoRechargeRequest = {
  /** The validated account UUID the caller may act on. */
  accountId: string;
  /** The requested auto top-up state. */
  enabled: boolean;
};

/**
 * Validates the full PATCH /api/accounts/{id}/auto-recharge request: the
 * `[id]` path param and caller access (via {@link validateAutoRechargeParams}),
 * then the JSON body (`{ enabled: boolean }`, parsed with the shared
 * `safeParseJson`). The handler calls only this function.
 *
 * @param request - The incoming HTTP request.
 * @param id - The raw `[id]` path param.
 * @returns A 4xx NextResponse to forward, or the validated accountId + enabled.
 */
export async function validateUpdateAutoRechargeBody(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedUpdateAutoRechargeRequest> {
  const validated = await validateAutoRechargeParams(request, id);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const body = await safeParseJson(request);
  const result = updateAutoRechargeBodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { accountId: validated, enabled: result.data.enabled };
}
