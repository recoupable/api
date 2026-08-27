import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Appends follower-count points to `social_snapshots`, one per social per
 * UTC day: a second scrape on the same day replaces that day's point
 * (upsert on `(social_id, captured_on)`), so the latest scrape wins.
 * `captured_at` / `captured_on` default to now() in the database.
 *
 * @param rows - One row per social with a follower count.
 * @returns The written snapshot rows.
 */
export async function upsertSocialSnapshots(rows: TablesInsert<"social_snapshots">[]) {
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from("social_snapshots")
    .upsert(rows, { onConflict: "social_id,captured_on" })
    .select("*");

  if (error) {
    console.error("[ERROR] upsertSocialSnapshots:", error);
    throw error;
  }

  return data ?? [];
}
