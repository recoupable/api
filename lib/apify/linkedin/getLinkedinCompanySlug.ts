/**
 * Returns the lower-case slug of a LinkedIn company page URL in any form
 * (bare, with protocol, `www.`, trailing path or query), or null for anything
 * else. LinkedIn slugs are case-insensitive and the actors echo them
 * lower-case, so lower-casing keeps one `socials` row per company page.
 *
 * @param input - A LinkedIn profile URL, company page URL or handle.
 * @returns The company page slug, or null when the input is not one.
 */
export function getLinkedinCompanySlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input
    .trim()
    .match(/^(?:https?:\/\/)?(?:[a-z]+\.)?linkedin\.com\/company\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}
