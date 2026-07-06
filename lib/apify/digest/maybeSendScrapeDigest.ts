import { selectApifyScraperRunsByBatch } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRunsByBatch";
import { getScrapeDigestRecipients } from "@/lib/apify/digest/getScrapeDigestRecipients";
import { sendScrapeDigestEmail } from "@/lib/apify/digest/sendScrapeDigestEmail";
import { selectRecentScrapeDigestLogs } from "@/lib/supabase/email_send_log/selectRecentScrapeDigestLogs";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";

/**
 * Batch-completion check for the one-digest-per-scrape design (chat#1855):
 * called after each platform run's results are processed. Sends the single
 * consolidated digest when (a) every sibling run in the batch has completed
 * and (b) at least one platform found genuinely new posts. Platforms with
 * nothing new are omitted; a batch with nothing new sends nothing.
 */
export async function maybeSendScrapeDigest(batchId: string | null | undefined) {
  if (!batchId) return null;

  const runs = await selectApifyScraperRunsByBatch(batchId);
  if (!runs.length || runs.some(r => !r.completed_at)) return null;

  const sections = runs
    .filter(r => (r.new_post_urls?.length ?? 0) > 0)
    .map(r => ({ platform: r.platform ?? "other", postUrls: r.new_post_urls ?? [] }));
  if (!sections.length) return null;

  const { emails, artistIds } = await getScrapeDigestRecipients(
    runs.map(r => r.social_id).filter((id): id is string => Boolean(id)),
  );

  // Rate cap: at most one digest per watched artist entity per 24h (chat#1855).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await selectRecentScrapeDigestLogs(artistIds, since);
  if (recent.length > 0) return null;

  const sent = await sendScrapeDigestEmail({ emails, sections });

  // Audit trail: record the send per artist entity so alerts are debuggable
  // and the cap has something to read (the solo path never logged at all).
  const resendId = (sent as { id?: string } | null)?.id;
  if (sent) {
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
  }
  return sent;
}
