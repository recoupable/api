import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { z } from "zod";

const getTaskRunQuerySchema = z.object({
  runId: z
    .string()
    .min(1)
    .transform(val => val.trim())
    .optional(),
  account_id: z
    .string()
    .min(1)
    .transform(val => val.trim())
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export type ValidatedRetrieveQuery = { mode: "retrieve"; runId: string };
export type ValidatedListQuery = { mode: "list"; accountId: string; limit: number };
export type GetTaskRunQuery = ValidatedRetrieveQuery | ValidatedListQuery;

/**
 * Validates auth context and query parameters for GET /api/tasks/runs.
 *
 * Returns a discriminated union:
 * - `{ mode: "retrieve", runId }` when runId is provided
 * - `{ mode: "list", accountId, limit }` when runId is omitted
 *
 * When account_id is provided:
 * - Admin accounts (Bearer token) may query any account
 * - Org API keys may query accounts within their organization
 * - Personal API keys may only query their own account
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export async function validateGetTaskRunQuery(
  request: NextRequest,
): Promise<NextResponse | GetTaskRunQuery> {
  // Validate auth context
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const runId = request.nextUrl.searchParams.get("runId") || undefined;
  const accountIdParam = request.nextUrl.searchParams.get("account_id") || undefined;
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;

  const result = getTaskRunQuerySchema.safeParse({ runId, account_id: accountIdParam, limit });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  if (result.data.runId) {
    return { mode: "retrieve", runId: result.data.runId };
  }

  // Resolve the target account ID
  let targetAccountId = authResult.accountId;

  if (result.data.account_id && result.data.account_id !== authResult.accountId) {
    // Check admin access first (admin can query any account)
    const isAdmin = await checkIsAdmin(authResult.accountId);
    if (isAdmin) {
      targetAccountId = result.data.account_id;
    } else if (authResult.orgId) {
      // Org API keys can query accounts within their org
      const hasAccess = await canAccessAccount({
        orgId: authResult.orgId,
        targetAccountId: result.data.account_id,
      });

      if (!hasAccess) {
        return NextResponse.json(
          { status: "error", error: "Access denied to specified account_id" },
          { status: 403, headers: getCorsHeaders() },
        );
      }

      targetAccountId = result.data.account_id;
    } else {
      return NextResponse.json(
        { status: "error", error: "account_id override requires an org API key or admin access" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  return { mode: "list", accountId: targetAccountId, limit: result.data.limit };
}
