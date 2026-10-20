/**
 * One provider media reference retained on a `posts` row
 * (recoupable/app#2132, Context Engine CE16).
 *
 * Provider URL only, never bytes: nothing is fetched, stored or analyzed,
 * and the entry is reference-only evidence rather than an approved
 * production asset. `provider_url` is the still image the scraper reports
 * (the cover frame for a `video` item; the stream URL is not retained) and
 * provider CDN URLs may expire. `kind` is the scraper's item type, or
 * `unknown` when it reports something this mapping does not recognize.
 */
export type PostMediaEntry = {
  position: number;
  kind: "image" | "video" | "unknown";
  provider_url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
  source: "apify_instagram";
};
