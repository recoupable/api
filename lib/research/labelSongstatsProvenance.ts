import { TrackStatsPayload } from "@/lib/research/playcounts/trackStatsPayloadSchema";

/**
 * Label every Songstats-sourced stat entry with its provenance
 * (`data_source: "songstats"`), per the contract in docs#238. Pure typed
 * transform — the payload is validated once at the orchestrator boundary
 * ({@link trackStatsPayloadSchema}).
 *
 * @param payload - The parsed Songstats stats payload
 * @returns The payload with labeled stat entries
 */
export function labelSongstatsProvenance(payload: TrackStatsPayload): TrackStatsPayload {
  if (!payload.stats) return payload;
  return {
    ...payload,
    stats: payload.stats.map(entry => ({ ...entry, data_source: "songstats" })),
  };
}
