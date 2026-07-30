/** A capture that failed has nothing to hand back; every other live state does. */
const REUSABLE_STATES = new Set(["queued", "running", "done"]);

/**
 * Whether a capture in this state can satisfy a new request for the same scope.
 *
 * Shared by the reuse pre-check and the post-insert race reconcile. They must
 * agree: if the reconcile recognised only `queued`, a winner that advanced to
 * `running` between the two reads would be invisible and both requests would
 * scrape — the exact race this is meant to close (chat#1912 rows 4 and 7).
 */
export function isReusableSnapshotState(state: string | null): boolean {
  return REUSABLE_STATES.has(state ?? "");
}
