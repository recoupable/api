import apifyClient from "@/lib/apify/client";
import { upsertSocialsWithSnapshot } from "@/lib/socials/upsertSocialsWithSnapshot";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import { getLinkedinCompanyUrl } from "@/lib/apify/linkedin/getLinkedinCompanyUrl";
import { getLinkedinCompanySlug } from "@/lib/apify/linkedin/getLinkedinCompanySlug";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/** One company item from the harvestapi/linkedin-company dataset (README sample shape). */
type HarvestApiLinkedinCompany = {
  universalName?: string;
  linkedinUrl?: string;
  tagline?: string;
  description?: string;
  logo?: string;
  followerCount?: number;
  error?: string;
};

/**
 * Handles LinkedIn company details (harvestapi/linkedin-company) webhook
 * results: the company page counterpart of the profile handler, which runs
 * when a company page is scraped without a posts depth (app#2398). Persists
 * the page's logo, description and follower count to its `socials` row,
 * keyed on the `linkedin.com/company/<slug>` profile_url.
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleLinkedinCompanyScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const company = items[0] as HarvestApiLinkedinCompany | undefined;

  const companyUrl = getLinkedinCompanyUrl(company?.linkedinUrl);
  if (!company || company.error || !companyUrl) {
    return { social: null };
  }

  const social = {
    profile_url: normalizeProfileUrl(companyUrl),
    // `socials.username` is required; the page slug stands in when the actor omits it.
    username: company.universalName || getLinkedinCompanySlug(companyUrl)!,
    avatar: company.logo ?? null,
    bio: company.description || company.tagline || null,
    followerCount: company.followerCount ?? null,
  };
  await upsertSocialsWithSnapshot([social]);

  return { social };
}
