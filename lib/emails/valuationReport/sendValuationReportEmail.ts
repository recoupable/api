import { NextResponse } from "next/server";
import { CHAT_APP_URL, RECOUP_FROM_EMAIL } from "@/lib/const";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { renderValuationReportHtml } from "@/lib/emails/valuationReport/renderValuationReportHtml";
import { buildReleaseRows } from "@/lib/emails/valuationReport/buildReleaseRows";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectCatalogById } from "@/lib/supabase/catalogs/selectCatalogById";
import { selectCatalogMeasurementsAggregate } from "@/lib/supabase/song_measurements/selectCatalogMeasurementsAggregate";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import { computeValuationBand } from "@/lib/catalog/computeValuationBand";
import type { ValuationReportEmailParams } from "@/lib/emails/valuationReport/valuationReportTypes";
import type { SpotifyArtist } from "@/types/spotify.types";
import type { Tables } from "@/types/database.types";

export type SendValuationReportEmailResult =
  | { sent: true; resendId: string }
  | { sent: false; skipped: "already_sent" | "no_email" }
  | { sent: false; error: string };

/**
 * Emails the valuation summary for a completed snapshot run to the owning
 * account (recoupable/chat#1867, enriched per chat#1881). Reproduces the
 * marketing / chat catalog-report result — artist header, headline band,
 * measured-scope stats, and a per-release table with album art + proportional
 * value — so it reinforces numbers the signup already saw. Idempotent per run
 * twice over: a `"snapshot_id"` marker in `email_send_log.raw_body` guards
 * re-invocations for as long as the log exists, and the Resend idempotency key
 * (`valuation-report/<id>`) guards racing retries within Resend's 24h window.
 * Skips silently when the account has no email. Every enrichment step is
 * best-effort: a failure degrades toward the link-only email rather than
 * dropping the send. Fired from runValuationHandler after the catalog is
 * materialized (chat#1881), so `snapshot.catalog` is set by call time.
 *
 * @param snapshot - The completed playcount_snapshots row (with catalog claimed)
 * @param options.artist - The searched Spotify artist for the header (name, avatar, followers)
 */
export async function sendValuationReportEmail(
  snapshot: Tables<"playcount_snapshots">,
  options: { artist?: SpotifyArtist | null } = {},
): Promise<SendValuationReportEmailResult> {
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

  const params: ValuationReportEmailParams = {
    catalogName: null,
    deepLinkUrl: snapshot.catalog ? `${CHAT_APP_URL}/catalogs/${snapshot.catalog}` : CHAT_APP_URL,
    albumCount: snapshot.album_count ?? snapshot.album_ids?.length ?? 0,
  };

  if (options.artist?.name) {
    params.artist = {
      name: options.artist.name,
      imageUrl: options.artist.images?.[0]?.url ?? null,
      followers: options.artist.followers?.total ?? null,
    };
  }

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

        const releases = await buildReleaseRows(
          snapshot.catalog,
          snapshot.album_ids ?? [],
          aggregate.totalStreams,
          valuation.mid,
        );
        params.releases = releases;
        params.releaseCount = releases?.length || undefined;
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
