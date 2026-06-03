import type { Json } from "@/types/database.types";
import type { ResearchCacheRefreshInput } from "@/lib/research/cache/ResearchCacheRefreshInput";
import { RESEARCH_METRICS_CACHE_TTL_MS } from "@/lib/research/cache/researchCacheConfig";
import { fetchResearchProvider } from "@/lib/research/providers/fetchResearchProvider";
import { upsertResearchCacheEntry } from "@/lib/supabase/research_cache_entries/upsertResearchCacheEntry";

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function expiresAtForEndpoint(endpoint: string, now: Date): string {
  const ttl = endpoint === "artist_metrics" ? RESEARCH_METRICS_CACHE_TTL_MS : 60 * 60 * 1000;
  return new Date(now.getTime() + ttl).toISOString();
}

export async function refreshResearchCacheStep(input: ResearchCacheRefreshInput): Promise<void> {
  "use step";

  console.log(`[research-cache] Refreshing ${input.endpoint}:${input.entityId}`);
  const result = await fetchResearchProvider(input.path, input.query);
  const now = new Date();

  if (result.status === 200) {
    await upsertResearchCacheEntry({
      cache_key: input.cacheKey,
      provider: input.provider,
      endpoint: input.endpoint,
      entity_type: input.entityType,
      entity_id: input.entityId,
      source: input.source ?? null,
      query: input.query,
      data: toJson(result.data),
      raw_data: toJson(result.data),
      status: "ready",
      status_code: result.status,
      error: null,
      fetched_at: now.toISOString(),
      expires_at: expiresAtForEndpoint(input.endpoint, now),
      refresh_started_at: null,
    });
    console.log(`[research-cache] Refreshed ${input.endpoint}:${input.entityId}`);
    return;
  }

  await upsertResearchCacheEntry({
    cache_key: input.cacheKey,
    provider: input.provider,
    endpoint: input.endpoint,
    entity_type: input.entityType,
    entity_id: input.entityId,
    source: input.source ?? null,
    query: input.query,
    status: "failed",
    status_code: result.status,
    error: `Request failed with status ${result.status}`,
    refresh_started_at: null,
  });
  console.warn(
    `[research-cache] Refresh failed for ${input.endpoint}:${input.entityId} status=${result.status}`,
  );
}
