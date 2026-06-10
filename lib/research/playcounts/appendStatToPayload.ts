import { SpotifyStoreStat } from "@/lib/research/playcounts/toStat";
import { TrackStatsPayload } from "@/lib/research/playcounts/trackStatsPayloadSchema";

/**
 * Append a store-served stat entry to a Songstats payload's `stats[]` array,
 * preserving the rest of the envelope (`track_info`, `source_ids`, …). Pure
 * typed transform — the payload is validated once at the orchestrator
 * boundary ({@link trackStatsPayloadSchema}).
 *
 * @param payload - The parsed (labeled) Songstats stats payload
 * @param stat - The measurement-store stat entry to append
 * @returns The merged payload
 */
export function appendStatToPayload(
  payload: TrackStatsPayload,
  stat: SpotifyStoreStat,
): TrackStatsPayload {
  return { ...payload, stats: [...(payload.stats ?? []), stat] };
}
