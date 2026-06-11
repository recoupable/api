import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Select songs by ISRC list.
 *
 * @param isrcs - The ISRCs to fetch
 * @returns Matching song rows, or [] if none exist or on error
 */
export async function selectSongs(isrcs: string[]): Promise<Tables<"songs">[]> {
  if (isrcs.length === 0) return [];

  const { data, error } = await supabase.from("songs").select("*").in("isrc", isrcs);

  if (error) {
    console.error("Error fetching songs:", error);
    return [];
  }

  return data || [];
}
