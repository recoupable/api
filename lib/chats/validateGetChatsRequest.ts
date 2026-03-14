import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { SelectRoomsParams } from "@/lib/supabase/rooms/selectRooms";
import { buildGetChatsParams } from "./buildGetChatsParams";
import { z } from "zod";

const getChatsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
});

/**
 * Validates GET /api/chats request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys: Returns accountIds with the key owner's account
 * For org keys: Returns orgId for filtering by org membership in database
 * For Recoup admin key: Returns empty params to indicate ALL chat records
 *
 * Query parameters:
 * - account_id: Filter to a specific account (validated against org membership)
 * - artist_account_id: Filter by artist ID
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or SelectRoomsParams
 */
export async function validateGetChatsRequest(
  request: NextRequest,
): Promise<NextResponse | SelectRoomsParams> {
  // Parse query parameters first
  const { searchParams } = new URL(request.url);
  const queryParams = {
    account_id: searchParams.get("account_id") ?? undefined,
    artist_account_id: searchParams.get("artist_account_id") ?? undefined,
  };

  const queryResult = getChatsQuerySchema.safeParse(queryParams);
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

  const { account_id: target_account_id, artist_account_id: artist_id } = queryResult.data;

  // Use validateAuthContext for authentication
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId: account_id, orgId: org_id } = authResult;

  // Use shared function to build params
  const { params, error } = await buildGetChatsParams({
    account_id,
    org_id,
    target_account_id,
    artist_id,
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

  return params;
}
