const EXA_BASE_URL = "https://api.exa.ai";

export interface ExaPersonResult {
  title: string;
  url: string;
  id: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  summary?: string;
}

export interface ExaPeopleResponse {
  results: ExaPersonResult[];
  requestId: string;
}

/**
 * Searches Exa's people index for individuals matching the query.
 * Uses Exa's category: "people" filter for multi-source people data
 * including LinkedIn profiles.
 *
 * @param query - Natural language search (e.g., "A&R reps at Atlantic Records")
 * @param numResults - Number of results to return (default 10, max 100)
 * @returns People search results with highlights
 */
export async function searchPeople(
  query: string,
  numResults: number = 10,
): Promise<ExaPeopleResponse> {
  const safeNumResults = Math.min(100, Math.max(1, Math.floor(numResults)));
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("EXA_API_KEY environment variable is not set");
  }

  const response = await fetch(`${EXA_BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      category: "people",
      numResults: safeNumResults,
      contents: {
        highlights: { maxCharacters: 4000 },
        summary: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Exa API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();

  return {
    results: data.results || [],
    requestId: data.requestId || "",
  };
}
