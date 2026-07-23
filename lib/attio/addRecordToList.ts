import { attioFetch } from "@/lib/attio/request";

/**
 * Add a record to a list as a new entry. Best-effort — logs on failure and
 * never throws. Caller is responsible for dedup (see isRecordInList).
 */
export async function addRecordToList(
  listSlug: string,
  object: string,
  recordId: string,
  entryValues: Record<string, unknown>,
): Promise<void> {
  const res = await attioFetch(`/lists/${listSlug}/entries`, {
    method: "POST",
    body: JSON.stringify({
      data: { parent_object: object, parent_record_id: recordId, entry_values: entryValues },
    }),
  });
  if (!res.ok) {
    console.error(`[attio] add to list ${listSlug} failed: ${res.status} — ${await res.text()}`);
  }
}
