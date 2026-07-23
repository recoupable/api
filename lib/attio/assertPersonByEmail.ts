import { attioFetch } from "@/lib/attio/request";

/**
 * Assert (create-or-update) a Person by email and set attribute values, via
 * Attio's `matching_attribute` upsert. Returns the record id, or an error
 * string if the upsert failed.
 */
export async function assertPersonByEmail(
  values: Record<string, unknown>,
): Promise<{ recordId?: string; error?: string }> {
  const res = await attioFetch("/objects/people/records?matching_attribute=email_addresses", {
    method: "PUT",
    body: JSON.stringify({ data: { values } }),
  });
  if (!res.ok) {
    return { error: `Attio person assert failed: ${res.status} — ${await res.text()}` };
  }
  const data = await res.json().catch(() => null);
  return { recordId: data?.data?.id?.record_id };
}
