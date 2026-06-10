/**
 * Label every Songstats-sourced stat entry in a payload with its provenance
 * (`data_source: "songstats"`), per the contract in docs#238. Non-object
 * payloads and payloads without a `stats[]` array pass through unchanged.
 *
 * @param data - The Songstats response payload
 * @returns The payload with labeled stat entries
 */
export function labelSongstatsProvenance(data: unknown): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
  const payload = data as Record<string, unknown>;
  if (!Array.isArray(payload.stats)) return data;
  return {
    ...payload,
    stats: payload.stats.map(entry =>
      typeof entry === "object" && entry !== null
        ? { ...(entry as Record<string, unknown>), data_source: "songstats" }
        : entry,
    ),
  };
}
