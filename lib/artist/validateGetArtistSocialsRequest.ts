import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

/**
 * Shared pagination defaults for the get-artist-socials surface.
 * Single source of truth used by both the API query schema and the MCP tool schema.
 */
export const GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const;

/**
 * Pagination schema for the API route — query params arrive as strings and must
 * be transformed into numbers before validation.
 */
const getArtistSocialsPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default(String(GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.page))
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default(String(GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.limit))
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.maxLimit)),
});

/**
 * MCP-friendly schema shape for `get_artist_socials`. Numbers are pre-parsed
 * by the MCP transport, so this mirrors the API contract without string
 * transforms. Exported as a raw shape so it can be passed to
 * `server.registerTool({ inputSchema })`.
 */
export const getArtistSocialsToolSchema = {
  artist_account_id: z
    .string()
    .min(1, "artist_account_id parameter is required")
    .describe("The unique identifier of the artist account"),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.page)
    .describe(
      `Page number for pagination (default: ${GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.page})`,
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.maxLimit)
    .optional()
    .default(GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.limit)
    .describe(
      `Number of socials per page (default: ${GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.limit}, max: ${GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.maxLimit})`,
    ),
};

export type ArtistSocialsToolInput = z.infer<z.ZodObject<typeof getArtistSocialsToolSchema>>;

export interface GetArtistSocialsRequest {
  artistAccountId: string;
  page: number;
  limit: number;
  authContext: AuthContext;
}

/**
 * Validates GET /api/artists/{id}/socials path params, query params, authentication,
 * and the requester's access to the target artist.
 *
 * Order of checks:
 * 1. Path-segment `id` must be a valid UUID (400 on failure).
 * 2. Optional `page`/`limit` query params parse to positive integers (400 on failure).
 * 3. Auth headers validated via `validateAuthContext` (401 on missing/invalid).
 * 4. Artist account exists (404 if not).
 * 5. Requester has access to the artist (403 if not).
 *
 * @param request - The incoming NextRequest
 * @param id - The artist account ID from the route
 * @returns The validated payload, or a NextResponse error
 */
export async function validateGetArtistSocialsRequest(
  request: NextRequest,
  id: string,
): Promise<GetArtistSocialsRequest | NextResponse> {
  const validatedParams = validateAccountParams(id);
  if (validatedParams instanceof NextResponse) {
    return validatedParams;
  }

  const { searchParams } = new URL(request.url);
  const queryResult = getArtistSocialsPaginationSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
        socials: [],
        pagination: {
          total_count: 0,
          page: GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.page,
          limit: GET_ARTIST_SOCIALS_PAGINATION_DEFAULTS.limit,
          total_pages: 0,
        },
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistAccountId = validatedParams.id;

  const existingArtist = await selectAccounts(artistAccountId);
  if (!existingArtist.length) {
    return NextResponse.json(
      {
        status: "error",
        error: "Artist not found",
      },
      {
        status: 404,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await checkAccountArtistAccess(authResult.accountId, artistAccountId);
  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        error: "Unauthorized",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    artistAccountId,
    page: queryResult.data.page,
    limit: queryResult.data.limit,
    authContext: authResult,
  };
}
