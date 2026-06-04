interface GetIdsResponse {
  songstats_track_ids?: string[];
  songstats_track_id?: string;
  id?: string | number;
}

/**
 * Extracts a provider track ID from a get-ids response payload, if present.
 */
export function extractProviderTrackId(data: unknown): string | undefined {
  const ids = (Array.isArray(data) ? data[0] : data) as GetIdsResponse | undefined;
  const id = ids?.songstats_track_ids?.[0] ?? ids?.songstats_track_id ?? ids?.id;

  return id === undefined || id === null || id === "" ? undefined : String(id);
}
