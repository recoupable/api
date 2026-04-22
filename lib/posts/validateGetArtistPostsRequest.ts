import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { paginationQuerySchema } from "@/lib/zod/paginationQuerySchema";
import { errorResponse } from "@/lib/networking/errorResponse";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

export const getArtistPostsParamsSchema = paginationQuerySchema().extend({
  artist_account_id: z.string({ error: "id is required" }).uuid("id must be a valid UUID"),
});

export type GetArtistPostsParams = z.infer<typeof getArtistPostsParamsSchema>;

/**
 * Bundles auth, path-id + query parsing, account existence (404), and
 * artist-access check (403) so the handler stays a thin orchestration shell.
 */
export async function validateGetArtistPostsRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistPostsParams | NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const parsed = getArtistPostsParamsSchema.safeParse({
    artist_account_id: id,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const [artist] = await selectAccounts(parsed.data.artist_account_id);
  if (!artist) return errorResponse("Artist not found", 404);

  const hasAccess = await checkAccountArtistAccess(
    authResult.accountId,
    parsed.data.artist_account_id,
  );
  if (!hasAccess) return errorResponse("Unauthorized", 403);

  return parsed.data;
}
