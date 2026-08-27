import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * `captured_on` is NOT NULL with no default because the database derives it
 * from `captured_at` in a BEFORE INSERT trigger; callers never supply it.
 */
export type SocialSnapshotInsert = Omit<TablesInsert<"social_snapshots">, "captured_on">;

/**
 * Appends follower-count points to `social_snapshots`, one per social per
 * UTC day: a second scrape on the same day replaces that day's point
 * (upsert on `(social_id, captured_on)`), so the latest scrape wins —
 * `captured_at` is stamped here on every write so the day's point carries
 * the latest scrape's time, and the database derives `captured_on` from it.
 *
 * @param rows - One row per social with a follower count.
 * @returns The written snapshot rows.
 */
export async function upsertSocialSnapshots(rows: SocialSnapshotInsert[]) {
  if (rows.length === 0) return [];
  const capturedAt = new Date().toISOString();
  const stamped = rows.map(r => ({
    captured_at: capturedAt,
    ...r,
  })) as TablesInsert<"social_snapshots">[];
  const { data, error } = await supabase
    .from("social_snapshots")
    .upsert(stamped, { onConflict: "social_id,captured_on" })
    .select("*");

  if (error) {
    console.error("[ERROR] upsertSocialSnapshots:", error);
    throw error;
  }

  return data ?? [];
}
