import supabase from "../serverClient";

/**
 * Reverse lookup: map external identifier values (e.g. Spotify track ids) to
 * songs. Used to join actor results back to ISRCs.
 *
 * @param platform - The platform (e.g. "spotify")
 * @param identifierType - The identifier kind (e.g. "track_id")
 * @param values - External identifier values to resolve
 * @returns Rows of { song, value } for the values that have a mapping
 */
export async function selectSongsByIdentifierValues(
  platform: string,
  identifierType: string,
  values: string[],
): Promise<{ song: string; value: string }[]> {
  if (values.length === 0) return [];

  const { data, error } = await supabase
    .from("song_identifiers")
    .select("song, value")
    .eq("platform", platform)
    .eq("identifier_type", identifierType)
    .in("value", values);

  if (error) {
    return [];
  }

  return data || [];
}
