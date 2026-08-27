import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

type SelectSocialSnapshotsParams = {
  socialIds: string[];
  /** Window in days, counted back from now. */
  days: number;
};

/** PostgREST returns at most 1000 rows per request; one social has at most one point per day. */
const MAX_ROWS_PER_REQUEST = 1000;

/**
 * Follower-count points for a set of socials within the last `days`,
 * newest first. Queries in chunks sized so `socials × days` stays under
 * the per-request row cap (and the `in()` URL stays short), so a 100-social
 * page with `history=90` never silently drops older points.
 * Returns [] for an empty id list without querying.
 */
export async function selectSocialSnapshots({
  socialIds,
  days,
}: SelectSocialSnapshotsParams): Promise<Tables<"social_snapshots">[]> {
  if (socialIds.length === 0) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const chunkSize = Math.max(1, Math.floor(MAX_ROWS_PER_REQUEST / days));

  const rows: Tables<"social_snapshots">[] = [];
  for (let i = 0; i < socialIds.length; i += chunkSize) {
    const { data, error } = await supabase
      .from("social_snapshots")
      .select("*")
      .in("social_id", socialIds.slice(i, i + chunkSize))
      .gte("captured_at", since)
      .order("captured_at", { ascending: false });
    if (error) {
      console.error("[ERROR] selectSocialSnapshots:", error);
      throw error;
    }
    rows.push(...(data ?? []));
  }
  return rows;
}
