import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

const getTaskRunQuerySchema = z.object({
  runId: z
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

  const runId = request.nextUrl.searchParams.get("runId") ?? undefined;
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;

  const result = getTaskRunQuerySchema.safeParse({ runId, limit });

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

  return { mode: "list", accountId: authResult.accountId, limit: result.data.limit };
}
