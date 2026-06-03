import { start } from "workflow/api";
import { refreshResearchCacheWorkflow } from "@/app/workflows/refreshResearchCacheWorkflow";
import type { ResearchCacheRefreshInput } from "@/lib/research/cache/ResearchCacheRefreshInput";
import { upsertResearchCacheEntry } from "@/lib/supabase/research_cache_entries/upsertResearchCacheEntry";

export function kickRefreshResearchCacheWorkflow(input: ResearchCacheRefreshInput): void {
  void start(refreshResearchCacheWorkflow, [input]).then(
    async run => {
      await upsertResearchCacheEntry({
        cache_key: input.cacheKey,
        provider: input.provider,
        endpoint: input.endpoint,
        entity_type: input.entityType,
        entity_id: input.entityId,
        source: input.source ?? null,
        query: input.query,
        status: "refreshing",
        refresh_started_at: new Date().toISOString(),
        refresh_run_id: run.runId,
      });
      console.log(
        `[research-cache] Started refresh workflow ${run.runId} for ${input.endpoint}:${input.entityId}`,
      );
    },
    error => {
      console.error(
        `[research-cache] Failed to start refresh workflow for ${input.endpoint}:${input.entityId}:`,
        error,
      );
    },
  );
}
