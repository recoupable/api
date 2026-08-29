const BLOCKED_SONGSTATS_QUERY_KEYS = new Set(["songstats_artist_id", "spotify_artist_id"]);

/**
 * Copies safe passthrough params; blocks artist ID overrides and duplicate primary keys.
 */
export function appendPassthroughQueryParams(
  params: Record<string, string>,
  rest: Record<string, string>,
  extraBlocked: string[] = ["isPrimary", "is_primary"],
): void {
  const blocked = new Set([...BLOCKED_SONGSTATS_QUERY_KEYS, ...extraBlocked]);
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === "") continue;
    if (blocked.has(key)) continue;
    params[key] = value;
  }
}
