/**
 * Strips legacy search params, keeping only `q` plus optional `limit`/`offset`.
 */
export function withoutLegacySearchParams(query?: Record<string, string>): Record<string, string> {
  return {
    q: query?.q || "",
    ...(query?.limit ? { limit: query.limit } : {}),
    ...(query?.offset ? { offset: query.offset } : {}),
  };
}
