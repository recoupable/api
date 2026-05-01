export const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

/**
 * Gets the Perplexity API key from the environment variables.
 *
 * @returns The Perplexity API key.
 */
export function getPerplexityApiKey(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error(
      "PERPLEXITY_API_KEY environment variable is not set. " +
        "Please add it to your environment variables.",
    );
  }

  return apiKey;
}

/**
 * Gets the Perplexity headers for the API request.
 *
 * @param apiKey - The Perplexity API key.
 * @returns The Perplexity headers.
 */
export function getPerplexityHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}
