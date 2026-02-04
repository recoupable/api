import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

export const snapshotPatchBodySchema = z.object({
  snapshotId: z.string({ message: "snapshotId is required" }).min(1, "snapshotId cannot be empty"),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type SnapshotPatchBody = {
  /** The account ID to update */
  accountId: string;
  /** The snapshot ID to set */
  snapshotId: string;
};

/**
 * Validates auth and request body for PATCH /api/sandboxes/snapshot.
 * Handles authentication via x-api-key or Authorization bearer token,
 * body validation, and optional account_id override for organization API keys.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated body with auth context.
 */
export async function validateSnapshotPatchBody(
  request: NextRequest,
): Promise<NextResponse | SnapshotPatchBody> {
  const body = await safeParseJson(request);
  const result = snapshotPatchBodySchema.safeParse(body);

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

  const { snapshotId, account_id: targetAccountId } = result.data;

  const authResult = await validateAuthContext(request, {
    accountId: targetAccountId,
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return {
    accountId: authResult.accountId,
    snapshotId,
  };
}
