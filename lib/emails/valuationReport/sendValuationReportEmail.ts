import { NextResponse } from "next/server";
import { CHAT_APP_URL, RECOUP_FROM_EMAIL } from "@/lib/const";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { renderValuationReportHtml } from "@/lib/emails/valuationReport/renderValuationReportHtml";
import { selectValuationEmailSendLog } from "@/lib/supabase/email_send_log/selectValuationEmailSendLog";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/renderValuationReportHtml";
import type { Tables } from "@/types/database.types";

export type SendValuationReportEmailResult =
  | { sent: true; resendId: string }
  | { sent: false; skipped: "already_sent" | "no_email" }
  | { sent: false; error: string };

/**
 * Emails the valuation summary for a completed snapshot run to the owning
 * account (recoupable/chat#1867): headline valuation band + lifetime streams
 * + measured counts, deep-linked to the catalog report on chat. Idempotent
 * per run twice over: a `"snapshot_id"` marker in `email_send_log.raw_body`
 * guards re-invocations for as long as the log exists, and the Resend
 * idempotency key (`valuation-report/<id>`) guards racing retries within
 * Resend's 24h window. Skips silently when the account has no email.
 * Measurement enrichment is best-effort: a read failure degrades to the
 * link-only email rather than dropping the send.
 *
 * @param snapshot - The completed playcount_snapshots row
 */
export async function sendValuationReportEmail(
  snapshot: Tables<"playcount_snapshots">,
): Promise<SendValuationReportEmailResult> {
  if (await selectValuationEmailSendLog(snapshot.id)) {
    return { sent: false, skipped: "already_sent" };
  }

  const emailRows = await selectAccountEmails({ accountIds: snapshot.account });
  const emails = [...new Set(emailRows.map(row => row.email).filter((e): e is string => !!e))];
  if (emails.length === 0) {
    return { sent: false, skipped: "no_email" };
  }

  const params: ValuationReportEmailParams = {
    catalogName: null,
    deepLinkUrl: snapshot.catalog ? `${CHAT_APP_URL}/catalogs/${snapshot.catalog}` : CHAT_APP_URL,
    albumCount: snapshot.album_count ?? snapshot.album_ids?.length ?? 0,
  };

  if (snapshot.catalog) {
    try {
      const [catalog, aggregate, earliestReleaseDate] = await Promise.all([
        selectCatalogById(snapshot.catalog),
        selectCatalogMeasurementsAggregate({ catalogId: snapshot.catalog }),
        getCatalogEarliestReleaseDate(snapshot.catalog),
      ]);
      params.catalogName = catalog?.name ?? null;
      if (aggregate && aggregate.totalStreams > 0) {
        const { valuation, catalogAgeYears } = computeValuationBand({
          totalStreams: aggregate.totalStreams,
          earliestReleaseDate,
        });
        params.valuation = valuation;
        params.totalStreams = aggregate.totalStreams;
        params.measuredSongCount = aggregate.measuredSongCount;
        params.catalogAgeYears = catalogAgeYears;
      }
    } catch (error) {
      console.error(`Valuation email enrichment failed for snapshot ${snapshot.id}:`, error);
    }
  }

  const { subject, html } = renderValuationReportHtml(params);
  const rawBody = JSON.stringify({
    type: "valuation_report",
    snapshot_id: snapshot.id,
    catalog: snapshot.catalog,
    to: emails,
    subject,
  });

  const result = await sendEmailWithResend(
    { from: RECOUP_FROM_EMAIL, to: emails, subject, html },
    { idempotencyKey: `valuation-report/${snapshot.id}` },
  );

  if (result instanceof NextResponse) {
    await logEmailAttempt({ rawBody, status: "send_failed", accountId: snapshot.account });
    const data = await result.json().catch(() => null);
    const message = typeof data?.error === "string" ? data.error : "Failed to send email";
    return { sent: false, error: message };
  }

  await logEmailAttempt({
    rawBody,
    status: "sent",
    accountId: snapshot.account,
    resendId: result.id,
  });
  return { sent: true, resendId: result.id };
}
