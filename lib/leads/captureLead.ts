import { assertPersonByEmail } from "@/lib/attio/assertPersonByEmail";
import { createNote } from "@/lib/attio/createNote";
import { sendSalesNotification } from "@/lib/telegram/sendSalesNotification";
import { isTestEmail } from "@/lib/emails/isTestEmail";
import { buildAttioName } from "@/lib/leads/buildAttioName";
import { buildLeadNote } from "@/lib/leads/buildLeadNote";
import { buildLeadNotification } from "@/lib/leads/buildLeadNotification";
import { packageLabel } from "@/lib/leads/packageLabel";
import type { PostLeadsBody } from "@/lib/leads/validatePostLeadsBody";

const ATTIO_WORKSPACE = "recoup";

export type CaptureLeadResult =
  | { success: true; notified: boolean; recordUrl?: string }
  | { success: false; error: string };

/**
 * Capture a marketing-site lead: store it in Attio, attach the triage note,
 * and page a human on Telegram — the server-side owner of the flow, modeled on
 * `captureValuationLead` (recoupable/chat#1800).
 *
 * Storage is the success criterion and **fails loudly**: an Attio failure
 * returns an error (the route turns it into a 502) and pages nobody — a
 * notification about a lead that was not stored would be a false alarm. The
 * note and the Telegram ping are best-effort once the person exists.
 *
 * The package labels a $5,000/mo enquiry; buildLeadNotification carries the
 * triage fields and the Attio deep link so the channel can open the lead in
 * one tap. `notified` mirrors the `isTestEmail` filter so verification is
 * assertable over HTTP instead of by watching the channel.
 *
 * @param lead - The validated lead.
 * @returns The capture outcome.
 */
export async function captureLead(lead: PostLeadsBody): Promise<CaptureLeadResult> {
  if (!process.env.ATTIO_API_KEY) {
    return { success: false, error: "ATTIO_API_KEY not configured" };
  }

  const name = buildAttioName(lead.name);
  const { recordId, error } = await assertPersonByEmail({
    email_addresses: [{ email_address: lead.email }],
    ...(name && { name }),
  });
  if (error) return { success: false, error };

  const recordUrl = recordId
    ? `https://app.attio.com/${ATTIO_WORKSPACE}/person/${recordId}/overview`
    : undefined;

  const note = buildLeadNote(lead);
  if (note && recordId) {
    await createNote({
      parentObject: "people",
      parentRecordId: recordId,
      title: note.title,
      content: note.content,
    });
  }

  // sendSalesNotification applies the isTestEmail filter itself and never
  // throws; the local read is what makes `notified` assertable over HTTP.
  const notified = !isTestEmail(lead.email);
  const labeled = lead.kind === "booking" ? { ...lead, package: packageLabel(lead.package) } : lead;
  const text = buildLeadNotification(labeled) + (recordUrl ? `\nAttio: ${recordUrl}` : "");
  await sendSalesNotification({ email: lead.email, text }).catch(err => {
    console.error("[leads] notifier failed:", err);
  });

  return { success: true, notified, recordUrl };
}
