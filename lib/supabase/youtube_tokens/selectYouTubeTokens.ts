import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Retrieves YouTube tokens for an artist account.
 *
 * @param artist_account_id - The artist account ID
 * @returns The YouTube tokens record, or null if not found
 */
export async function selectYouTubeTokens(
  artist_account_id: string,
): Promise<Tables<"youtube_tokens"> | null> {
  const { data, error } = await supabase
    .from("youtube_tokens")
    .select("*")
    .eq("artist_account_id", artist_account_id)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
