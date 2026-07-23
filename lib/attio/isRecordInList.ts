import { attioFetch } from "@/lib/attio/request";

/**
 * Whether a record already has an entry in the given list (matched by list id).
 * Used to avoid duplicate pipeline cards. Returns false on any read failure so
 * the caller can decide whether to create — never throws.
 */
export async function isRecordInList(
  object: string,
  recordId: string,
  listId: string,
): Promise<boolean> {
  const res = await attioFetch(`/objects/${object}/records/${recordId}/entries`, {
    method: "GET",
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  const entries: Array<{ list_id?: string; id?: { list_id?: string } }> = data?.data ?? [];
  return entries.some(e => (e.list_id ?? e.id?.list_id) === listId);
}
