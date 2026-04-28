import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildGetSandboxesParams } from "./buildGetSandboxesParams";
import { z } from "zod";

const getSandboxesFileQuerySchema = z.object({
  path: z.string({ message: "path is required" }).min(1, "path cannot be empty"),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export interface ValidatedGetSandboxesFileParams {
  accountIds?: string[];
  orgId?: string;
  path: string;
}

/**
 * Validates GET /api/sandboxes/file request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * Query parameters:
 * - path: The file path within the repository (required)
 * - account_id: Filter to a specific account (validated against org membership)
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or validated params
 */
export async function validateGetSandboxesFileRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetSandboxesFileParams> {
  const { searchParams } = new URL(request.url);
  const queryParams = {
    path: searchParams.get("path") ?? undefined,
    account_id: searchParams.get("account_id") ?? undefined,
  };

  const queryResult = getSandboxesFileQuerySchema.safeParse(queryParams);
  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { path, account_id: targetAccountId } = queryResult.data;

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  const { params, error } = await buildGetSandboxesParams({
    account_id: accountId,
    target_account_id: targetAccountId,
  });

  if (error) {
    return NextResponse.json(
      {
        status: "error",
        error,
      },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return {
    accountIds: params.accountIds,
    orgId: orgId ?? undefined,
    path,
  };
}
