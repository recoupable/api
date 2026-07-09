import { selectApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns";
import { getRunDigestSection } from "@/lib/apify/digest/getRunDigestSection";
import type { RunDigestSection } from "@/lib/apify/digest/getRunDigestSection";
import { getScrapeDigestRecipients } from "@/lib/apify/digest/getScrapeDigestRecipients";
import { sendScrapeDigestEmail } from "@/lib/apify/digest/sendScrapeDigestEmail";
import { selectScrapeDigestLogs } from "@/lib/supabase/email_send_log/selectScrapeDigestLogs";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";

/**
 * Batch-completion check for the one-digest-per-scrape design (chat#1855):
 * called after each platform run's results are processed. Sends the single
 * consolidated digest when (a) every sibling run in the batch has completed,
 * (b) at least one platform found genuinely new posts, (c) this batch has
 * never sent before (exact idempotency via its `scrape-digest:<batchId>`
 * audit row — a webhook retry must not duplicate the send), and (d) no
 * digest went to any watching artist in the last 24h (product frequency
 * cap). Every send is recorded in email_send_log per watched artist.
 */
export async function maybeSendScrapeDigest(batchId: string | null | undefined) {
  if (!batchId) return null;

  const runs = await selectApifyScraperRuns({ batchId });
  if (!runs.length || runs.some(r => !r.completed_at)) return null;

  const sections = (await Promise.all(runs.map(getRunDigestSection))).filter(
    (s): s is RunDigestSection => s !== null,
  );
  if (!sections.length) return null;

  const { emails, artistIds } = await getScrapeDigestRecipients(
    runs.map(r => r.social_id).filter((id): id is string => Boolean(id)),
  );

  // Exact non-duplication: one digest per batch, ever.
  const already = await selectScrapeDigestLogs({ batchId });
  if (already.length > 0) return null;

  // Product frequency cap: at most one digest per watched artist per 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await selectScrapeDigestLogs({ artistIds, since });
  if (recent.length > 0) return null;

  const artistName = sections.map(s => s.artistName).find(Boolean) ?? null;
  const sent = await sendScrapeDigestEmail({ emails, sections, artistName });
  if (!sent) return null;

  // Audit trail: record the send per watched artist entity — what the batch
  // dedup and the 24h cap read (the legacy solo path never logged at all).
  const resendId = (sent as { id?: string }).id;
  await Promise.all(
    artistIds.map(artistId =>
      logEmailAttempt({
        rawBody: `scrape-digest:${batchId}`,
        status: "sent",
        accountId: artistId,
        resendId,
      }),
    ),
  );
  return sent;
}
