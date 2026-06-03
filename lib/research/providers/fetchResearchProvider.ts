import { fetchChartmetric } from "@/lib/chartmetric/fetchChartmetric";
import { getResearchProvider } from "@/lib/research/providers/getResearchProvider";
import { fetchSongstatsResearch } from "@/lib/research/songstats/fetchSongstatsResearch";

interface ProxyResult {
  data: unknown;
  status: number;
}

export async function fetchResearchProvider(
  path: string,
  queryParams?: Record<string, string>,
): Promise<ProxyResult> {
  if (getResearchProvider() === "chartmetric") {
    return fetchChartmetric(path, queryParams);
  }

  return fetchSongstatsResearch(path, queryParams);
}
