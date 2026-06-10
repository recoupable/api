import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select external identifier rows for a song on a platform.
 *
 * @param song - The song ISRC
 * @param platform - The platform (e.g. "spotify")
 * @param identifierType - The identifier kind (e.g. "album_id", "track_id")
 * @returns Matching identifier rows, or [] if none exist or on error
 */
export async function selectSongIdentifiers(
  song: string,
  platform: string,
  identifierType: string,
): Promise<Tables<"song_identifiers">[]> {
  const { data, error } = await supabase
    .from("song_identifiers")
    .select("*")
    .eq("song", song)
    .eq("platform", platform)
    .eq("identifier_type", identifierType);

  if (error) {
    return [];
  }

  return data || [];
}
