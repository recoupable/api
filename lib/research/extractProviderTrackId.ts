interface GetIdsResponse {
  id?: string | number;
}

/**
 * Extracts a provider track ID from a normalized get-ids response payload.
 */
export function extractProviderTrackId(data: unknown): string | undefined {
  const ids = (Array.isArray(data) ? data[0] : data) as GetIdsResponse | undefined;
  const id = ids?.id;

  return id === undefined || id === null || id === "" ? undefined : String(id);
}
