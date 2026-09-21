import type { ReleaseContext } from "./schema";
import { searchPerplexity } from "@/lib/perplexity/searchPerplexity";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { PRICES_USD } from "@/lib/credits/pricesUsd";
import { requireCredits } from "./requireCredits";
export async function researchArtist(
  release: ReleaseContext["release"],
  accountId: string,
): Promise<ReleaseContext["research"]> {
  if (!release.url) return { status: "unavailable", sources: [], reason: "No identified release." };
  const cost = usdToCredits(PRICES_USD.researchWeb);
  await requireCredits(accountId, cost);
  try {
    const result = await searchPerplexity({
      query: `${release.artists.join(" ")} ${release.title} ${release.url} artist official website interview creative identity release`,
      max_results: 6,
      max_tokens_per_page: 600,
    });
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: cost,
      source: "api",
      modelId: "sites/artist-research",
    });
    const sources = result.results
      .filter(s => /^https:\/\//.test(s.url))
      .map(s => ({ title: s.title.slice(0, 300), url: s.url, snippet: s.snippet.slice(0, 4000) }));
    return { status: sources.length ? "available" : "unavailable", sources };
  } catch {
    return {
      status: "unavailable",
      sources: [],
      reason: "Artist research unavailable. Do not invent artist beliefs or biography.",
    };
  }
}
