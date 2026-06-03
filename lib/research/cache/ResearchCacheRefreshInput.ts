import type { ResearchProvider } from "@/lib/research/providers/ResearchProvider";

export type ResearchCacheRefreshInput = {
  cacheKey: string;
  provider: ResearchProvider;
  endpoint: string;
  entityType: string;
  entityId: string;
  source?: string | null;
  query: Record<string, string>;
  path: string;
};
