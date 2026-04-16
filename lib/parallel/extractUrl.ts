const PARALLEL_BASE_URL = "https://api.parallel.ai/v1beta";

export interface ExtractResult {
  url: string;
  title: string | null;
  publish_date: string | null;
  excerpts: string[] | null;
  full_content: string | null;
}

export interface ExtractResponse {
  extract_id: string;
  results: ExtractResult[];
  errors: Array<{ url: string; error: string }>;
}

/**
 * Extracts clean markdown content from one or more public URLs.
 * Handles JavaScript-heavy pages and PDFs. Returns focused excerpts
 * aligned to an objective, or full page content.
 *
 * @param urls - URLs to extract (max 10 per request)
 * @param objective - What information to focus on (optional, max 3000 chars)
 * @param fullContent - Return full page content instead of excerpts
 * @returns The extraction response with results and any errors.
 */
export async function extractUrl(
  urls: string[],
  objective?: string,
  fullContent: boolean = false,
): Promise<ExtractResponse> {
  const apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey) {
    throw new Error("PARALLEL_API_KEY environment variable is not set");
  }

  const response = await fetch(`${PARALLEL_BASE_URL}/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      urls,
      ...(objective && { objective }),
      excerpts: !fullContent,
      full_content: fullContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Parallel Extract API error: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  return await response.json();
}
