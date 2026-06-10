import { SpotifyStoreStat } from "@/lib/research/playcounts/toStat";
import { trackStatsPayloadSchema } from "@/lib/research/playcounts/trackStatsPayloadSchema";

/**
 * Append a store-served stat entry to a Songstats payload's `stats[]` array,
 * preserving the rest of the envelope (`track_info`, `source_ids`, …). The
 * payload is zod-validated against the envelope we operate on; payloads that
 * don't match are wrapped rather than dropped, so the store stat is always
 * delivered.
 *
 * @param payload - The (labeled) Songstats response payload
 * @param stat - The measurement-store stat entry to append
 * @returns The merged payload
 */
export function appendStatToPayload(
  payload: unknown,
  stat: SpotifyStoreStat,
): Record<string, unknown> {
  const parsed = trackStatsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { data: payload, stats: [stat] };
  }
  return { ...parsed.data, stats: [...(parsed.data.stats ?? []), stat] };
}
