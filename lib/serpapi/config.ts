/**
 * SerpAPI configuration for Google Images search.
 */
export const SERPAPI_BASE_URL = "https://serpapi.com";

/**
 * Retrieves the SerpAPI key from environment variables.
 * Throws if the key is not configured.
 *
 * @returns The SerpAPI API key string
 */
export function getSerpApiKey(): string {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "SERPAPI_API_KEY environment variable is not set. " +
        "Please add it to your environment variables.",
    );
  }

  return apiKey;
}
