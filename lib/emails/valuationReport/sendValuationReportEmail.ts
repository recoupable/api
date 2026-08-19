import { NextResponse } from "next/server";
import { CHAT_APP_URL, RECOUP_FROM_EMAIL } from "@/lib/const";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { renderValuationReportHtml } from "@/lib/emails/valuationReport/renderValuationReportHtml";
import { buildReleaseRows } from "@/lib/emails/valuationReport/buildReleaseRows";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import type { ValuationBand } from "@/lib/catalog/computeValuationBand";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";
import type { SpotifyArtist } from "@/types/spotify.types";
import type { Tables } from "@/types/database.types";

export type SendValuationReportEmailResult =
  | { sent: true; resendId: string }
  | { sent: false; skipped: "already_sent" | "no_email" }
  | { sent: false; error: string };

/**
 * Emails the valuation summary for a completed snapshot run to the owning
 * account (recoupable/chat#1867, enriched per chat#1881). Presentation-only
 * (chat#1969): the caller passes the valuation it already computed — this
 * function does no data fetching or valuation math, and the caller gates the
 * call on measured streams, so a numbers-free report is unrepresentable.
 * Idempotent per run twice over: a `"snapshot_id"` marker in
 * `email_send_log.raw_body` guards re-invocations for as long as the log
 * exists, and the Resend idempotency key (`valuation-report/<id>`) guards
 * racing retries within Resend's 24h window. Skips when the account has no
 * email. The release table is the only best-effort section (buildReleaseRows
 * degrades to no table); anything else fails loudly to the caller.
 */
export async function sendValuationReportEmail(params: {
  snapshot: Tables<"playcount_snapshots">;
  catalogId: string;
  catalogName: string | null;
  valuation: ValuationBand;
  totalStreams: number;
  measuredSongCount: number;
  catalogAgeYears: number;
  ageFlooredToOneYear: boolean;
  artist?: SpotifyArtist | null;
}): Promise<SendValuationReportEmailResult> {
  const { snapshot, catalogId, catalogName, valuation } = params;

  // Long-window idempotency: a prior successful send for this run is marked by
  // the `"snapshot_id":"<id>"` marker in raw_body (Resend's key only covers 24h).
  const alreadySent = await selectEmailSendLog({
    status: "sent",
    rawBodyLike: `"snapshot_id":"${snapshot.id}"`,
    limit: 1,
  });
  if (alreadySent.length > 0) {
    return { sent: false, skipped: "already_sent" };
  }

  const emailRows = await selectAccountEmails({ accountIds: snapshot.account });
  const emails = [...new Set(emailRows.map(row => row.email).filter((e): e is string => !!e))];
  if (emails.length === 0) {
    return { sent: false, skipped: "no_email" };
  }

  const { artist } = params;
  const renderParams: ValuationReportEmailParams = {
    catalogName,
    deepLinkUrl: `${CHAT_APP_URL}/catalogs/${catalogId}`,
    albumCount: snapshot.album_count ?? snapshot.album_ids?.length ?? 0,
    valuation,
    totalStreams: params.totalStreams,
    measuredSongCount: params.measuredSongCount,
    catalogAgeYears: params.catalogAgeYears,
    ageFlooredToOneYear: params.ageFlooredToOneYear,
    ...(artist?.name && {
      artist: {
        name: artist.name,
        imageUrl: artist.images?.[0]?.url ?? null,
        followers: artist.followers?.total ?? null,
      },
    }),
  };
  const releases = await buildReleaseRows(
    catalogId,
    snapshot.album_ids ?? [],
    params.totalStreams,
    valuation.mid,
  );
  renderParams.releases = releases;
  renderParams.releaseCount = releases?.length || undefined;

  const { subject, html } = renderValuationReportHtml(renderParams);
  const rawBody = JSON.stringify({
    type: "valuation_report",
    snapshot_id: snapshot.id,
    catalog: catalogId,
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
