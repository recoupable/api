import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

type FileRecord = Tables<"files">;

/**
 * Fetches all file rows for an artist, newest first.
 *
 * @param artistAccountId - Artist account whose files should be fetched.
 * @returns File rows ordered by creation time descending.
 */
export async function getFilesByArtistId(artistAccountId: string): Promise<FileRecord[]> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("artist_account_id", artistAccountId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get files by artist: ${error.message}`);
  }

  return data || [];
}
