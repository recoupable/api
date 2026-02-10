import { getSerpApiKey, SERPAPI_BASE_URL } from "./config";
import type { SerpApiResponse, SearchImagesOptions } from "./types";

/**
 * Searches Google Images via SerpAPI.
 *
 * Builds the query with optional filters (size, type, aspect ratio)
 * and returns image results limited to the requested count.
 *
 * @param options - Search parameters including query, limit, and optional filters
 * @returns SerpAPI response containing image results
 */
export async function searchGoogleImages(options: SearchImagesOptions): Promise<SerpApiResponse> {
  const { query, limit = 10, page = 0, imageSize, imageType, aspectRatio } = options;

  const apiKey = getSerpApiKey();

  // Build tbs parameter for advanced filtering
  const tbsParams: string[] = [];
  if (imageType) tbsParams.push(`itp:${imageType}`);
  if (imageSize) tbsParams.push(`isz:${imageSize}`);
  const tbs = tbsParams.length > 0 ? tbsParams.join(",") : undefined;

  // Build query parameters
  const params = new URLSearchParams({
    engine: "google_images",
    q: query,
    api_key: apiKey,
    ijn: page.toString(),
  });

  if (tbs) params.append("tbs", tbs);
  if (aspectRatio) params.append("imgar", aspectRatio);

  const url = `${SERPAPI_BASE_URL}/search.json?${params.toString()}`;

  // 10 second timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SerpAPI request failed: ${response.status} - ${errorText}`);
    }

    const data: SerpApiResponse = await response.json();

    // Limit results if specified
    if (limit && data.images_results) {
      data.images_results = data.images_results.slice(0, limit);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Google Images search timed out after 10 seconds. Please try again with a more specific query.",
      );
    }

    throw error;
  }
}
