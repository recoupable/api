import { z } from "zod";
import { searchPerplexity } from "@/lib/perplexity/searchPerplexity";

/** Discover candidate evidence, not verified artist facts. No model synthesis or implicit retry. */
export async function discoverContextArtistSources(
  input: { artistName: string; spotifyId: string; releaseTitle?: string },
  search: typeof searchPerplexity = searchPerplexity,
) {
  const name = z.string().trim().min(1).max(200).parse(input.artistName);
  z.string()
    .regex(/^[A-Za-z0-9]{22}$/)
    .parse(input.spotifyId);
  const query = {
    query: `${JSON.stringify(name)} ${input.releaseTitle ? JSON.stringify(input.releaseTitle) : ""} music artist official biography interview`,
    max_results: 5,
    max_tokens_per_page: 1200,
  };
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const response = await search(query);
  return {
    sources: response.results,
    coverage: "partial" as const,
    costUsd: null,
    costStatus: "unknown" as const,
    trace: {
      provider: "perplexity-search",
      input,
      query,
      response,
      startedAt,
      elapsedMs: Date.now() - started,
    },
    limitation:
      "Search results are candidate snippet evidence. Identity, full-page contents and image usage rights are not verified by discovery.",
  };
}
