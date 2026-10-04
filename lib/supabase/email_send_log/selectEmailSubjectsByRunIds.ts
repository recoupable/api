import supabase from "@/lib/supabase/serverClient";

/**
 * Maps Trigger.dev run ids to the subject of the most recent email each run
 * sent. Reads `email_send_log` rows linked via `trigger_run_id` (chat#1958);
 * rows are ordered oldest-first so later assignments win — the newest send's
 * subject names a run that emailed more than once.
 *
 * @param runIds - Trigger run ids to resolve.
 * @returns Map of run id → newest email subject (unmapped runs absent).
 */
export async function selectEmailSubjectsByRunIds(runIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (runIds.length === 0) return map;

  const { data, error } = await supabase
    .from("email_send_log")
    .select("trigger_run_id, subject, created_at")
    .in("trigger_run_id", runIds)
    .not("subject", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching email subjects by run ids:", error);
    return map;
  }

  for (const row of data ?? []) {
    if (row.trigger_run_id && row.subject) {
      map.set(row.trigger_run_id, row.subject);
    }
  }
  return map;
}
