import type { Tables } from "@/types/database.types";

/**
 * Chooses which of several competing claims on the same scope is the real one.
 *
 * Two simultaneous identical requests both insert before either can see the
 * other, so the reuse pre-check cannot help (chat#1912 row 7). Both then re-read
 * and call this, and because the ordering is total and independent of input
 * order they reach the same answer without coordinating: earliest claim wins,
 * ties broken by id.
 *
 * Rows with no timestamp cannot be ordered and are never crowned.
 */
export function pickCanonicalSnapshot(
  claims: Tables<"playcount_snapshots">[],
): Tables<"playcount_snapshots"> | null {
  const dated = claims.filter(row => !!row.created_at);
  if (dated.length === 0) return null;

  return dated.reduce((winner, row) => {
    const a = new Date(row.created_at!).getTime();
    const b = new Date(winner.created_at!).getTime();
    if (a !== b) return a < b ? row : winner;
    return row.id < winner.id ? row : winner;
  });
}
