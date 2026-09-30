import { attioFetch } from "@/lib/attio/request";

/**
 * Attach a markdown note and report whether the provider accepted it.
 * HTTP failures return false; transport errors may reject. Callers decide
 * whether note persistence is required for their success criterion.
 */
export async function createNote(note: {
  parentObject: string;
  parentRecordId: string;
  title: string;
  content: string;
}): Promise<boolean> {
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
    console.error(`[attio] note create failed: ${res.status}`);
    return false;
  }
  return true;
}
