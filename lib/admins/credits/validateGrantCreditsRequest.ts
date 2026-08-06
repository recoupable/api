import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

const grantCreditsBodySchema = z.object({
  account_id: z
    .string({ message: "account_id is required" })
    .uuid("account_id must be a valid UUID"),
  remaining_credits: z
    .number({ message: "remaining_credits is required" })
    .int("remaining_credits must be an integer")
    .min(0, "remaining_credits cannot be negative"),
  // Trimmed before the emptiness check so "   " is rejected rather than stored
  // as a reason that answers nothing.
  reason: z.string({ message: "reason is required" }).trim().min(1, "reason cannot be empty"),
});

export interface ValidatedGrantCreditsRequest {
  accountId: string;
  remainingCredits: number;
  reason: string;
  /** The acting admin, from credentials. `granted_by` in the body is ignored. */
  grantedBy: string;
}

/**
 * Validates admin auth + the request body for `POST /api/admins/credits`.
 *
 * Auth is checked before the body is read, so an unauthorized caller learns
 * nothing about which bodies would have been accepted.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse (400/401/403) on failure, or the parsed grant on success.
 */
export async function validateGrantCreditsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGrantCreditsRequest> {
  const auth = await validateAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const result = grantCreditsBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    accountId: result.data.account_id,
    remainingCredits: result.data.remaining_credits,
    reason: result.data.reason,
    grantedBy: auth.accountId,
  };
}
