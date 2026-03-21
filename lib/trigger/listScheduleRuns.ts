/**
 * Lists recent runs for a specific Trigger.dev schedule using the
 * Management REST API directly (the SDK doesn't support schedule filtering).
 *
 * @param scheduleId - The Trigger.dev schedule ID (e.g. sched_xxx)
 * @param limit - Maximum number of runs to return (default 5)
 * @returns Array of run objects
 */
export async function listScheduleRuns(scheduleId: string, limit: number = 5) {
  const apiKey = process.env.TRIGGER_SECRET_KEY;
  if (!apiKey) {
    throw new Error("Missing TRIGGER_SECRET_KEY");
  }

  const url = new URL("https://api.trigger.dev/api/v1/runs");
  url.searchParams.set("filter[schedule]", scheduleId);
  url.searchParams.set("page[size]", String(limit));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Trigger.dev API error: ${response.status}`);
  }

  const json = (await response.json()) as { data?: unknown[] };
  return json.data ?? [];
}
