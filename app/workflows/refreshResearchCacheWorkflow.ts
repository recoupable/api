import type { ResearchCacheRefreshInput } from "@/lib/research/cache/ResearchCacheRefreshInput";
import { refreshResearchCacheStep } from "@/app/workflows/refreshResearchCacheStep";

export async function refreshResearchCacheWorkflow(input: ResearchCacheRefreshInput) {
  "use workflow";

  console.log(`[research-cache] workflow:start ${input.endpoint}:${input.entityId}`);
  await refreshResearchCacheStep(input);
  console.log(`[research-cache] workflow:done ${input.endpoint}:${input.entityId}`);
}
