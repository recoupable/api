import { selectApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRuns";
import { getRunDigestSection } from "@/lib/apify/digest/getRunDigestSection";
import type { RunDigestSection } from "@/lib/apify/digest/getRunDigestSection";
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

  const sections = (await Promise.all(runs.map(getRunDigestSection))).filter(
    (s): s is RunDigestSection => s !== null,
  );
  if (!sections.length) return null;

  const emails = await getScrapeDigestRecipients(
    runs.map(r => r.social_id).filter((id): id is string => Boolean(id)),
  );
  // A batch is one artist's scrape — any platform's profile name addresses it.
  const artistName = sections.map(s => s.artistName).find(Boolean) ?? null;
  return await sendScrapeDigestEmail({ emails, sections, artistName });
}
