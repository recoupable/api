import { Resend } from "resend";

/** Add an explicitly opted-in reader without resetting an existing unsubscribe.
 * Segment-entry automation owns welcome delivery; broadcasts own unsubscribe links.
 */
export async function enrollResearchSubscriber(
  email: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_RESEARCH_SEGMENT_ID;
  if (!key || !segmentId || process.env.RESEND_RESEARCH_READY !== "true") {
    return { success: false, error: "Newsletter delivery is not configured" };
  }
  const failure = { success: false as const, error: "Newsletter signup could not be confirmed" };
  try {
    const resend = new Resend(key);
    const normalized = email.trim().toLowerCase();
    const existing = await resend.contacts.get({ email: normalized });
    if (existing.error && existing.error.name !== "not_found") return failure;
    if (existing.data?.unsubscribed) return failure;
    let contactId = existing.data?.id;
    if (!contactId) {
      // Omit unsubscribed so a concurrent create cannot reset an unsubscribe.
      const created = await resend.contacts.create({ email: normalized });
      if (created.error || !created.data?.id) return failure;
      contactId = created.data.id;
    }
    const added = await resend.contacts.segments.add({ contactId, segmentId });
    if (added.error) return failure;
    return { success: true };
  } catch {
    return failure;
  }
}
