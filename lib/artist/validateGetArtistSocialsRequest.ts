import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const pageSchema = z.coerce.number().int().positive().default(DEFAULT_PAGE);
const limitSchema = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT);

export const getArtistSocialsToolSchema = {
  artist_account_id: z.string().min(1).describe("The artist account ID"),
  page: pageSchema.describe(`Page number (default: ${DEFAULT_PAGE})`),
  limit: limitSchema.describe(`Per page (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`),
};

export interface GetArtistSocialsRequest {
  artist_account_id: string;
  page: number;
  limit: number;
}

const errorResponse = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: getCorsHeaders() });

export async function validateGetArtistSocialsRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistSocialsRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) return validatedParams;

  const { searchParams } = new URL(request.url);
  const query = z.object({ page: pageSchema, limit: limitSchema }).safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!query.success) {
    return errorResponse(400, { status: "error", error: query.error.issues[0].message });
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const artist_account_id = validatedParams.id;
  const [artist] = await selectAccounts(artist_account_id);
  if (!artist) return errorResponse(404, { status: "error", error: "Artist not found" });

  const hasAccess = await checkAccountArtistAccess(authResult.accountId, artist_account_id);
  if (!hasAccess) return errorResponse(403, { status: "error", error: "Unauthorized" });

  return { artist_account_id, page: query.data.page, limit: query.data.limit };
}
