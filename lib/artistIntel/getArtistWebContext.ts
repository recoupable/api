import { searchPerplexity, type SearchResult } from "@/lib/perplexity/searchPerplexity";

export interface ArtistWebContext {
  results: SearchResult[];
  summary: string;
}

/**
 * Fetches recent web context about an artist using Perplexity search.
 *
 * @param artistName - The artist name to research.
 * @returns Web search results with a summary, or null on failure.
 */
export async function getArtistWebContext(artistName: string): Promise<ArtistWebContext | null> {
  try {
    const response = await searchPerplexity({
      query: `${artistName} music artist 2025 new release streaming stats news`,
      max_results: 5,
    });

    const summary = response.results
      .slice(0, 3)
      .map(r => r.snippet)
      .join(" | ");

    return {
      results: response.results,
      summary,
    };
  } catch (error) {
    console.error("Perplexity search failed:", error);
    return null;
  }
}
