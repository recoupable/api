/**
 * Fetches runs from the Trigger.dev Management REST API.
 *
 * @param params - Query parameters for filtering runs
 * @param limit - Maximum number of runs to return
 * @returns Array of run objects
 */
export async function fetchTriggerRuns(
  params: Record<string, string>,
  limit: number,
): Promise<unknown[]> {
  const apiKey = process.env.TRIGGER_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Missing TRIGGER_SECRET_KEY");
  }

  const url = new URL("https://api.trigger.dev/api/v1/runs");
  url.searchParams.set("page[size]", String(limit));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Trigger.dev API error: ${response.status}`);
  }

  const json = (await response.json()) as { data?: unknown[] };
  return json.data ?? [];
}
