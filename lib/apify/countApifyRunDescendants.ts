import { selectApifyScraperRunIdsByParent } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRunIdsByParent";

/** A healthy chain is 3 deep (profile → comments → fans); anything past this is a bug. */
const MAX_DEPTH = 5;

/**
 * Counts every run spawned, directly or transitively, by `rootRunId` —
 * "how many runs has this scrape cost so far". Walks generation by
 * generation, bounded so a pathological chain cannot recurse forever.
 */
export async function countApifyRunDescendants(rootRunId: string): Promise<number> {
  let frontier = [rootRunId];
  let total = 0;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    frontier = await selectApifyScraperRunIdsByParent(frontier);
    total += frontier.length;
  }
  return total;
}
