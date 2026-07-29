import { attioFetch } from "@/lib/attio/request";

/**
 * Attach a markdown note to a record. Best-effort — logs on failure and never
 * throws, so a notes outage can't break the caller's flow.
 */
export async function createNote(note: {
  parentObject: string;
  parentRecordId: string;
  title: string;
  content: string;
}): Promise<void> {
  const res = await attioFetch("/notes", {
    method: "POST",
    body: JSON.stringify({
      data: {
        parent_object: note.parentObject,
        parent_record_id: note.parentRecordId,
        title: note.title,
        format: "markdown",
        content: note.content,
      },
    }),
  });
  if (!res.ok) {
    console.error(`[attio] note create failed: ${res.status} — ${await res.text()}`);
  }
}
