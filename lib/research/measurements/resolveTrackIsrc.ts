import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";

/** ISRC shape: 2 letters (country) + 10 alphanumerics. */
const ISRC_PATTERN = /^[A-Za-z]{2}[A-Za-z0-9]{10}$/;

/**
 * Resolve a provider-neutral track id (ISRC or Spotify track id) to its ISRC —
 * the key the measurement store is indexed by. ISRC-shaped ids pass through;
 * anything else is treated as a Spotify track id and reverse-looked-up.
 *
 * @param id - ISRC or Spotify track id
 * @returns The ISRC, or null when a non-ISRC id maps to nothing
 */
export async function resolveTrackIsrc(id: string): Promise<string | null> {
  if (ISRC_PATTERN.test(id)) return id;

  const rows = await selectSongIdentifiers({
    platform: "spotify",
    identifierType: "track_id",
    values: [id],
  });
  return rows[0]?.song ?? null;
}
