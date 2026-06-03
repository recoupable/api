import type { ResearchProvider } from "@/lib/research/providers/ResearchProvider";

export function getResearchProvider(): ResearchProvider {
  const provider = process.env.RESEARCH_PROVIDER?.trim().toLowerCase();
  if (provider === "chartmetric") return "chartmetric";
  return "songstats";
}
