import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { paginationQuerySchema } from "@/lib/zod/paginationQuerySchema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

export const getPostsParamsSchema = paginationQuerySchema().extend({
  artist_account_id: z.string({ error: "id is required" }).uuid("id must be a valid UUID"),
});

export type GetPostsParams = z.infer<typeof getPostsParamsSchema>;

const errorResponse = (status: number, error: string) =>
  NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() });

export async function validateGetPostsRequest(
  request: NextRequest,
  id: string,
): Promise<GetPostsParams | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const parsed = getPostsParamsSchema.safeParse({
    artist_account_id: id,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const [artist] = await selectAccounts(parsed.data.artist_account_id);
  if (!artist) return errorResponse(404, "Artist not found");

  const hasAccess = await checkAccountArtistAccess(
    authResult.accountId,
    parsed.data.artist_account_id,
  );
  if (!hasAccess) return errorResponse(403, "Unauthorized");

  return parsed.data;
}
