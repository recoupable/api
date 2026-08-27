import { selectApifyScraperRunIdsByParent } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRunIdsByParent";

/** A healthy chain is 3 deep (profile → comments → fans); anything past this is a bug. */
const MAX_DEPTH = 5;

/**
 * Counts every run spawned, directly or transitively, by `rootRunId` —
 * "how many runs has this scrape cost so far" — up to `upTo`. Walks
 * generation by generation, bounded in depth, and stops as soon as the
 * count reaches `upTo` so a runaway chain is never fully enumerated (and
 * the next generation's `in()` never grows past the cap).
 *
 * @param rootRunId - The run a scrape endpoint started.
 * @param upTo - Stop counting once this many descendants are found.
 */
export async function countApifyRunDescendants(rootRunId: string, upTo: number): Promise<number> {
  let frontier = [rootRunId];
  let total = 0;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0 && total < upTo; depth++) {
    frontier = await selectApifyScraperRunIdsByParent(frontier.slice(0, upTo));
    total += frontier.length;
  }
  return Math.min(total, upTo);
}
