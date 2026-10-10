import { assertCatalogStreamRunActive } from "@/lib/catalog/assertCatalogStreamRunActive";
import { fetchLuminateStreams } from "@/lib/luminate/fetchLuminateStreams";
/** Memoized provider response is reused by write retries; recent dates are re-fetched for corrections. */
export async function fetchCatalogStreamTrackStep(runId: string, isrc: string) {
  "use step";
  const run = await assertCatalogStreamRunActive(runId, isrc);
  const result = await fetchLuminateStreams({ isrc, since: run.since, until: run.until });
  if (!result) return { state: "unavailable" as const };
  return {
    ...result,
    state: result.days.length === 62 ? ("complete" as const) : ("partial" as const),
  };
}
