import { chatWithPerplexity } from "@/lib/perplexity/chatWithPerplexity";

export interface ArtistWebContext {
  summary: string;
  citations: string[];
}

/**
 * Fetches rich narrative web context about an artist using Perplexity chat (sonar-pro).
 * Returns a researched summary with citations rather than raw search snippets.
 *
 * @param artistName - The artist name to research.
 * @returns A narrative summary with citations, or null on failure.
 */
export async function getArtistWebContext(artistName: string): Promise<ArtistWebContext | null> {
  try {
    const result = await chatWithPerplexity([
      {
        role: "user",
        content: `Research the music artist "${artistName}". Provide a concise but rich overview covering:
1. Who they are and their current career stage
2. Recent releases, streaming milestones, or news (2024-2025)
3. Their core sound and genre positioning
4. Notable collaborations, press coverage, or cultural moments
5. Why they matter right now in the music industry

Be specific and factual. Focus on current/recent information. Keep the response under 200 words.`,
      },
    ]);

    return {
      summary: result.content,
      citations: result.citations,
    };
  } catch (error) {
    console.error("Perplexity chat failed:", error);
    return null;
  }
}
