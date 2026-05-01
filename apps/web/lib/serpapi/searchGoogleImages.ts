import { getSerpApiKey } from "./config";
import { buildSearchUrl } from "./buildSearchParams";
import type { SerpApiResponse, SearchImagesOptions } from "./types";
import { DEFAULT_IMAGE_LIMIT } from "./types";

/**
 * Searches Google Images via SerpAPI.
 *
 * @param options - Search parameters including query, limit, and optional filters
 * @returns SerpAPI response with image results limited to the requested count
 */
export async function searchGoogleImages(options: SearchImagesOptions): Promise<SerpApiResponse> {
  const { limit = DEFAULT_IMAGE_LIMIT } = options;
  const apiKey = getSerpApiKey();
  const url = buildSearchUrl(options, apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SerpAPI request failed: ${response.status} - ${errorText}`);
    }

    const data: SerpApiResponse = await response.json();

    return {
      ...data,
      images_results: data.images_results?.slice(0, limit),
    };
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
