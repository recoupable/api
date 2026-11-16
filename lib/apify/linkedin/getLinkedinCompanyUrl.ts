import { getLinkedinCompanySlug } from "@/lib/apify/linkedin/getLinkedinCompanySlug";

/**
 * Returns the canonical company page URL (`https://www.linkedin.com/company/<slug>`)
 * when the input is a LinkedIn company page in any form (bare, with protocol,
 * `www.`, trailing path or query), or null for anything else. Company pages
 * must keep their `/company/` path: rebuilding them from the slug as
 * `/in/<slug>` scrapes a personal profile that does not exist (app#2398).
 *
 * @param input - A LinkedIn profile URL, company page URL or handle.
 * @returns The canonical company page URL, or null when the input is not one.
 */
export function getLinkedinCompanyUrl(input: string | null | undefined): string | null {
  const slug = getLinkedinCompanySlug(input);
  return slug ? `https://www.linkedin.com/company/${slug}` : null;
}
