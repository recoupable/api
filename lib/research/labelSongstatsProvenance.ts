import { trackStatsPayloadSchema } from "@/lib/research/playcounts/trackStatsPayloadSchema";

/**
 * Label every Songstats-sourced stat entry in a payload with its provenance
 * (`data_source: "songstats"`), per the contract in docs#238. The payload is
 * zod-validated against the envelope we operate on; payloads that don't match
 * (Songstats shape drift) pass through unchanged with a logged warning rather
 * than failing the response.
 *
 * @param data - The Songstats response payload
 * @returns The payload with labeled stat entries
 */
export function labelSongstatsProvenance(data: unknown): unknown {
  const parsed = trackStatsPayloadSchema.safeParse(data);
  if (!parsed.success) {
    console.warn("[research] unexpected Songstats stats payload shape:", parsed.error.message);
    return data;
  }
  if (!parsed.data.stats) return data;
  return {
    ...parsed.data,
    stats: parsed.data.stats.map(entry => ({ ...entry, data_source: "songstats" })),
  };
}
