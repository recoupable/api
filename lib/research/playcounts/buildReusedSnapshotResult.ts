import type { Tables } from "@/types/database.types";

/**
 * The 202-shaped payload for a request satisfied by an existing capture.
 * `estimated_cost_usd` is 0 because nothing was scraped, and `reused` lets
 * callers tell a fresh capture from a handed-back one (chat#1912 row 4).
 */
export function buildReusedSnapshotResult(snapshot: Tables<"playcount_snapshots">) {
  return {
    data: {
      status: "success",
      snapshot_id: snapshot.id,
      state: snapshot.state,
      album_count: snapshot.album_count,
      estimated_cost_usd: 0,
      reused: true,
    },
  };
}
