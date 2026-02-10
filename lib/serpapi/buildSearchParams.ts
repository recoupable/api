import { SERPAPI_BASE_URL } from "./config";
import type { SearchImagesOptions } from "./types";

/**
 * Builds the SerpAPI search URL with query parameters and filters.
 *
 * Note: SerpAPI requires api_key as a query parameter — header-based auth is not supported.
 * Ensure request URLs are not logged by middleware or error reporters.
 *
 * @param options - Search parameters including query and optional filters
 * @param apiKey - The SerpAPI API key
 * @returns The fully constructed search URL
 */
export function buildSearchUrl(options: SearchImagesOptions, apiKey: string): string {
  const { query, page = 0, imageSize, imageType, aspectRatio } = options;

  // SerpAPI uses "tbs" for advanced image filtering (type, size)
  const tbsParams: string[] = [];
  if (imageType) tbsParams.push(`itp:${imageType}`);
  if (imageSize) tbsParams.push(`isz:${imageSize}`);
  const tbs = tbsParams.length > 0 ? tbsParams.join(",") : undefined;

  const params = new URLSearchParams({
    engine: "google_images",
    q: query,
    api_key: apiKey,
    ijn: page.toString(),
  });

  if (tbs) params.append("tbs", tbs);
  if (aspectRatio) params.append("imgar", aspectRatio);

  return `${SERPAPI_BASE_URL}/search.json?${params.toString()}`;
}
