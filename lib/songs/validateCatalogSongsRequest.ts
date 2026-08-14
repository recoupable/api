import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { authorizeCatalogAccess } from "@/lib/songs/authorizeCatalogAccess";
import { z } from "zod";

const catalogSongInputSchema = z.object({
  catalog_id: z.string().min(1, "catalog_id is required"),
  isrc: z.string().min(1, "isrc is required"),
  name: z.string().optional(),
  album: z.string().optional(),
  notes: z.string().optional(),
  artists: z.array(z.string()).optional(),
});

export const catalogSongsRequestSchema = z.object({
  songs: z.array(catalogSongInputSchema).min(1, "songs array is required and must not be empty"),
});

export type CatalogSongsRequest = z.infer<typeof catalogSongsRequestSchema>;

export type ValidatedCatalogSongsRequest = CatalogSongsRequest & { accountId: string };

/**
 * Validates a catalog songs write (POST and DELETE share it): credentials,
 * then body shape, then that every catalog named belongs to the caller.
 *
 * The order is the contract (chat#1912 row 6, recoupable/docs#282). Auth runs
 * before the body is read so a caller with no credentials gets 401 rather than
 * a validation 400 — a 400 without credentials is precisely what proved this
 * endpoint had no auth layer at all. A write can name several catalogs, and
 * every one is checked: authorizing only the first would let one owned catalog
 * carry edits into catalogs the caller does not own.
 *
 * @param request - The incoming request, carrying `x-api-key` or a bearer token
 * @returns A NextResponse (401/400/403), or the validated body plus the
 *   authenticated account
 */
export async function validateCatalogSongsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedCatalogSongsRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  const body = await safeParseJson(request);
  const validationResult = catalogSongsRequestSchema.safeParse(body);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
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

  const forbidden = await authorizeCatalogAccess(
    auth.accountId,
    validationResult.data.songs.map(song => song.catalog_id),
  );
  if (forbidden) return forbidden;

  return { ...validationResult.data, accountId: auth.accountId };
}
