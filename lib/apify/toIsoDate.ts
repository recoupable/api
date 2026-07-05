/**
 * Converts an actor-supplied date string to ISO 8601, or undefined when the
 * value is absent or unparseable (callers let the posts upsert apply its
 * column default rather than forwarding a raw string Postgres may reject).
 *
 * Handles Twitter's legacy format ("Thu Jul 02 17:21:21 +0000 2026") via
 * `new Date()` — this service only runs on Node/V8, where that parse is
 * deterministic; the unit test pins the exact format so a runtime change
 * would fail loudly.
 *
 * @param value - Raw date string from an Apify actor item
 * @returns ISO 8601 string, or undefined when not parseable
 */
export function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
