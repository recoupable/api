import apifyClient from "@/lib/apify/client";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";
import type { ApifyWebhookPayload } from "@/lib/apify/validateApifyWebhookRequest";

/**
 * One profile item from the harvestapi/linkedin-profile-scraper dataset.
 * Field names taken from a real run (2026-07-01); missing-profile results
 * arrive as a wrapper `{ element: {}, error, status }` instead.
 */
type HarvestApiLinkedinProfile = {
  publicIdentifier?: string;
  linkedinUrl?: string;
  headline?: string;
  about?: string;
  followerCount?: number;
  photo?: string;
  location?: { linkedinText?: string };
  error?: string;
  element?: unknown;
};

/**
 * Handles LinkedIn profile scraper (harvestapi) webhook results: persists
 * the scraped profile back to `socials` (upsert keyed on `profile_url`),
 * so follower counts / avatar / bio refresh instead of living only in the
 * poll endpoint. Minimal counterpart of the Instagram results handler —
 * no posts/comments pipeline for LinkedIn yet.
 *
 * @param parsed - Validated Apify webhook payload.
 */
export async function handleLinkedinProfileScraperResults(parsed: ApifyWebhookPayload) {
  const { items } = await apifyClient.dataset(parsed.resource.defaultDatasetId).listItems();
  const first = items[0] as HarvestApiLinkedinProfile | undefined;

  // Missing/failed profiles come back as a {element, error, status} wrapper.
  if (!first || first.error || !first.linkedinUrl) {
    return { social: null };
  }

  const social = {
    profile_url: normalizeProfileUrl(first.linkedinUrl),
    username: first.publicIdentifier,
    avatar: first.photo ?? null,
    bio: first.about ?? first.headline ?? null,
    followerCount: first.followerCount ?? null,
    region: first.location?.linkedinText ?? null,
  };
  await upsertSocials([social]);

  return { social };
}
