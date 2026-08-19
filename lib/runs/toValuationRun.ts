import type { Tables } from "@/types/database.types";

export type ValuationRun = {
  id: string;
  kind: "valuation";
  state: "queued" | "measuring" | "claimed" | "failed";
  album_count: number;
  created_at: string;
  result: { catalog_id: string } | null;
};

/**
 * A finished capture is claimed into a catalog within seconds; past this
 * window an unclaimed capture is the orphaned class (chat#1965) and reads as
 * failed rather than spinning as measuring forever.
 */
const CLAIM_WINDOW_MS = 10 * 60 * 1000;

/**
 * Map a snapshot row onto the run resource's domain phases (chat#1973). The
 * contract deliberately never exposes storage values, so a future workflow
 * backend can swap in without a contract change: `queued` → queued, `running`
 * → measuring, `done` + catalog → claimed, `done` unclaimed inside the claim
 * window → measuring (the claim is landing), anything else → failed.
 */
export function toValuationRun(
  snapshot: Tables<"playcount_snapshots">,
  now: Date = new Date(),
): ValuationRun {
  const claimed = snapshot.state === "done" && !!snapshot.catalog;
  const ageMs = now.getTime() - new Date(snapshot.created_at).getTime();

  let state: ValuationRun["state"];
  if (claimed) state = "claimed";
  else if (snapshot.state === "queued") state = "queued";
  else if (snapshot.state === "running") state = "measuring";
  else if (snapshot.state === "done" && ageMs < CLAIM_WINDOW_MS) state = "measuring";
  else state = "failed";

  return {
    id: snapshot.id,
    kind: "valuation",
    state,
    album_count: snapshot.album_count ?? snapshot.album_ids?.length ?? 0,
    created_at: snapshot.created_at,
    result: claimed && snapshot.catalog ? { catalog_id: snapshot.catalog } : null,
  };
}
