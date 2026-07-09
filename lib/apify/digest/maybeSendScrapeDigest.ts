import { selectApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns";
import { getScrapeDigestRecipients } from "@/lib/apify/digest/getScrapeDigestRecipients";
import { sendScrapeDigestEmail } from "@/lib/apify/digest/sendScrapeDigestEmail";

/**
 * Batch-completion check for the one-digest-per-scrape design (chat#1855):
 * called after each platform run's results are processed. Sends the single
 * consolidated digest when (a) every sibling run in the batch has completed
 * and (b) at least one platform found genuinely new posts. Platforms with
 * nothing new are omitted; a batch with nothing new sends nothing.
 */
export async function maybeSendScrapeDigest(batchId: string | null | undefined) {
  if (!batchId) return null;

  const runs = await selectApifyScraperRuns({ batchId });
  if (!runs.length || runs.some(r => !r.completed_at)) return null;

  const sections = runs
    .filter(r => (r.new_post_urls?.length ?? 0) > 0)
    .map(r => ({ platform: r.platform ?? "other", postUrls: r.new_post_urls ?? [] }));
  if (!sections.length) return null;

  const emails = await getScrapeDigestRecipients(
    runs.map(r => r.social_id).filter((id): id is string => Boolean(id)),
  );
  return await sendScrapeDigestEmail({ emails, sections });
}
