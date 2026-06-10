import { SpotifyStoreStat } from "@/lib/research/playcounts/toStat";

/**
 * Append a store-served stat entry to a (labeled) Songstats payload's
 * `stats[]` array, preserving the rest of the envelope (`track_info`,
 * `source_ids`, …). Non-object payloads are wrapped rather than dropped.
 *
 * @param payload - The Songstats response payload
 * @param stat - The measurement-store stat entry to append
 * @returns The merged payload
 */
export function appendStatToPayload(
  payload: unknown,
  stat: SpotifyStoreStat,
): Record<string, unknown> {
  const envelope =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : { data: payload };
  const stats = Array.isArray(envelope.stats) ? envelope.stats : [];
  return { ...envelope, stats: [...stats, stat] };
}
