import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Upserts YouTube tokens for an artist account. Uses `artist_account_id` as
 * the conflict target so refreshes update the existing row in place.
 *
 * @param tokens - The YouTube tokens row to insert/update.
 * @returns The upserted row, or null on failure.
 */
export async function upsertYouTubeTokens(tokens: TablesInsert<"youtube_tokens">) {
  const { data, error } = await supabase
    .from("youtube_tokens")
    .upsert(tokens, { onConflict: "artist_account_id", ignoreDuplicates: false })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Error upserting YouTube tokens:", error);
    return null;
  }

  return data;
}
