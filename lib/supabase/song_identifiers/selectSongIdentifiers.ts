import supabase from "../serverClient";

export type SongIdentifierRow = {
  song: string;
  platform: string;
  identifier_type: string;
  value: string;
};

/**
 * Select external identifier rows for a platform + identifier kind, filtered
 * by song (forward lookup: ISRC → external ids) and/or by identifier values
 * (reverse lookup: external ids → ISRCs, e.g. joining actor results back to
 * songs).
 *
 * @param params.platform - The platform (e.g. "spotify")
 * @param params.identifierType - The identifier kind (e.g. "album_id", "track_id")
 * @param params.song - Optional song ISRC to filter by
 * @param params.songs - Optional batch of song ISRCs to filter by
 * @param params.values - Optional external identifier values to filter by
 * @returns Matching identifier rows, or [] if none exist or on error
 */
export async function selectSongIdentifiers({
  platform,
  identifierType,
  song,
  songs,
  values,
}: {
  platform: string;
  identifierType: string;
  song?: string;
  songs?: string[];
  values?: string[];
}): Promise<SongIdentifierRow[]> {
  if (values && values.length === 0) return [];
  if (songs && songs.length === 0) return [];

  let query = supabase
    .from("song_identifiers")
    .select("song, platform, identifier_type, value")
    .eq("platform", platform)
    .eq("identifier_type", identifierType);

  if (song) query = query.eq("song", song);
  if (songs && songs.length > 0) query = query.in("song", songs);
  if (values) query = query.in("value", values);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching song_identifiers:", error);
    return [];
  }

  return data || [];
}
