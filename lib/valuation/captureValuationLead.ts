import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { upsertValuationLead } from "@/lib/valuation/upsertValuationLead";
import type { ValuationLeadInput } from "@/lib/valuation/valuationLeadInput";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { usd } from "@/lib/format/usd";
import type { ValuationBand } from "@/lib/catalog/computeValuationBand";

export type CaptureValuationLeadInput = {
  accountId: string;
  artistName: string;
  artistId: string;
  /** The api valuation band ({ low, mid, high }); the lead's central = `mid`. */
  valueBand: ValuationBand;
  lifetimeStreams?: number;
  followerCount?: number;
};

/**
 * Capture a valuation lead + team alert for a completed `POST /api/valuation`
 * run — the server-side owner of the milestone, so **every** caller (chat,
 * direct api, marketing funnel) captures a lead, not just the marketing frontend
 * (chat#1885). Mirrors the marketing `/api/valuation/lead` route it replaces:
 * upsert the Attio Person + pipeline card, then ping the internal Telegram
 * channel with the email, artist, and value band. Two differences from the
 * marketing route: the owner's email is resolved from the account (never the
 * body), and the band arrives in api shape (`mid` is the central estimate).
 *
 * Best-effort and never throws — a lead/alert failure must never fail or block
 * the valuation. Fired from runValuationHandler via `after()` once the catalog
 * is materialized and the band computed.
 */
export async function captureValuationLead(input: CaptureValuationLeadInput): Promise<void> {
  try {
    // Resolve the owning account's email — the lead is keyed on it, so no email
    // means no lead to capture.
    const emailRows = await selectAccountEmails({ accountIds: input.accountId });
    const email = emailRows.map(row => row.email).find((e): e is string => !!e);
    if (!email) return;

    const lead: ValuationLeadInput = {
      email,
      artistName: input.artistName,
      artistId: input.artistId,
      valueBand: {
        low: input.valueBand.low,
        central: input.valueBand.mid,
        high: input.valueBand.high,
      },
    };
    if (typeof input.lifetimeStreams === "number") lead.lifetimeStreams = input.lifetimeStreams;
    if (typeof input.followerCount === "number") lead.followerCount = input.followerCount;

    // Attio is the system of record. Don't block the ping on an Attio error —
    // the valuation already succeeded — but log a dropped lead so it's observable.
    const attio = await upsertValuationLead(lead);
    if (!attio.success) {
      console.error("[valuation/lead] Attio enrichment failed:", attio.error);
    }

    // Deep-link the Attio record so the channel can open the lead in one tap.
    const attioLink = attio.recordUrl ? `\nAttio: ${attio.recordUrl}` : "";
    await sendMessage(
      `💰 Valuation lead\n` +
        `Email: ${email}\n` +
        `Artist: ${input.artistName}\n` +
        `Estimated catalog value: ${usd(input.valueBand.mid)} ` +
        `(range ${usd(input.valueBand.low)}–${usd(input.valueBand.high)})` +
        attioLink,
    );
  } catch (error) {
    console.error("Valuation lead capture failed:", error);
  }
}
