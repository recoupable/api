import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { z } from "zod";

const getAdminEmailsQuerySchema = z.object({
  account_id: z
    .string()
    .min(1)
    .transform((val) => val.trim())
    .optional(),
  email_id: z
    .string()
    .min(1)
    .transform((val) => val.trim())
    .optional(),
});

export type ValidatedAccountQuery = { mode: "account"; accountId: string };
export type ValidatedEmailQuery = { mode: "email"; emailId: string };
export type GetAdminEmailsQuery = ValidatedAccountQuery | ValidatedEmailQuery;

/**
 * Validates admin auth and query parameters for GET /api/admins/emails.
 *
 * Returns a discriminated union:
 * - `{ mode: "email", emailId }` when email_id is provided (preferred)
 * - `{ mode: "account", accountId }` when account_id is provided
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated query
 */
export async function validateGetAdminEmailsQuery(
  request: NextRequest,
): Promise<NextResponse | GetAdminEmailsQuery> {
  const auth = await validateAdminAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const accountId = request.nextUrl.searchParams.get("account_id") || undefined;
  const emailId = request.nextUrl.searchParams.get("email_id") || undefined;

  const result = getAdminEmailsQuerySchema.safeParse({ account_id: accountId, email_id: emailId });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (result.data.email_id) {
    return { mode: "email", emailId: result.data.email_id };
  }

  if (result.data.account_id) {
    return { mode: "account", accountId: result.data.account_id };
  }

  return NextResponse.json(
    { status: "error", error: "must provide either account_id or email_id" },
    { status: 400, headers: getCorsHeaders() },
  );
}
