import { selectSongsWithArtists } from "@/lib/supabase/songs/selectSongsWithArtists";
import type { GetSongsParams } from "@/lib/songs/validateGetSongsRequest";

/**
 * Returns the `{ status, songs }` envelope for GET /api/songs, optionally
 * filtered by `isrc` and/or `artist_account_id`. Envelope shape matches the
 * legacy Express `/songs` response byte-for-byte so existing callers
 * (`chat/lib/catalog/getSongsByIsrc.ts`) require no shape adaptation.
 *
 * @param params - Validated query params (snake_case, from `validateGetSongsRequest`).
 * @returns `{ status: "success", songs }` with per-song flattened `artists`.
 */
export async function getSongsWithArtists(params: GetSongsParams) {
  const songs = await selectSongsWithArtists(params);
  return {
    status: "success" as const,
    songs,
  };
}
