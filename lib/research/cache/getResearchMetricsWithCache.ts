import type { Json } from "@/types/database.types";
import { getResearchProvider } from "@/lib/research/providers/getResearchProvider";
import { fetchResearchProvider } from "@/lib/research/providers/fetchResearchProvider";
import { buildResearchCacheKey } from "@/lib/research/cache/buildResearchCacheKey";
import type { ResearchCacheRefreshInput } from "@/lib/research/cache/ResearchCacheRefreshInput";
import { RESEARCH_CACHE_REFRESH_DEDUPE_MS } from "@/lib/research/cache/researchCacheConfig";
import { kickRefreshResearchCacheWorkflow } from "@/lib/research/cache/kickRefreshResearchCacheWorkflow";
import { resolveArtist } from "@/lib/research/resolveArtist";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { selectResearchCacheEntry } from "@/lib/supabase/research_cache_entries/selectResearchCacheEntry";
import { upsertResearchCacheEntry } from "@/lib/supabase/research_cache_entries/upsertResearchCacheEntry";
import type { Tables } from "@/types/database.types";

type ResearchCacheEntry = Tables<"research_cache_entries">;

export type GetResearchMetricsWithCacheParams = {
  accountId: string;
  artist: string;
  artistId?: string;
  source: string;
};

export type GetResearchMetricsWithCacheResult =
  | { data: unknown }
  | { pending: true }
  | { error: string; status: number };

function isExpired(entry: ResearchCacheEntry, now = Date.now()): boolean {
  return !entry.expires_at || Date.parse(entry.expires_at) <= now;
}

function hasUsableData(entry: ResearchCacheEntry | null): entry is ResearchCacheEntry & {
  data: Json;
} {
  return entry?.data !== null && entry?.data !== undefined;
}

function shouldStartRefresh(entry: ResearchCacheEntry | null, now = Date.now()): boolean {
  if (!entry) return true;
  if (!entry.refresh_started_at) return true;
  return now - Date.parse(entry.refresh_started_at) > RESEARCH_CACHE_REFRESH_DEDUPE_MS;
}

async function recordResearchRead(accountId: string): Promise<void> {
  try {
    await recordCreditDeduction({
      accountId,
      creditsToDeduct: 5,
      source: "api",
    });
  } catch (error) {
    console.error("[research] credit deduction failed:", error);
  }
}

async function fetchDirectMetrics(
  accountId: string,
  path: string,
): Promise<GetResearchMetricsWithCacheResult> {
  const result = await fetchResearchProvider(path, undefined);
  if (result.status !== 200) {
    return { error: `Request failed with status ${result.status}`, status: result.status };
  }

  await recordResearchRead(accountId);
  return { data: result.data };
}

async function queueRefresh(input: ResearchCacheRefreshInput): Promise<void> {
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
  });
  kickRefreshResearchCacheWorkflow(input);
}

export async function getResearchMetricsWithCache(
  params: GetResearchMetricsWithCacheParams,
): Promise<GetResearchMetricsWithCacheResult> {
  const resolved = params.artistId ? { id: params.artistId } : await resolveArtist(params.artist);
  if ("error" in resolved) return { error: resolved.error, status: 404 };

  const provider = getResearchProvider();
  const path = `/artist/${resolved.id}/stat/${params.source}`;
  if (provider === "chartmetric") {
    return fetchDirectMetrics(params.accountId, path);
  }

  const endpoint = "artist_metrics";
  const entityType = "artist";
  const query: Record<string, string> = {};
  const cacheKey = buildResearchCacheKey({
    provider,
    endpoint,
    entityType,
    entityId: resolved.id,
    source: params.source,
    query,
  });
  const refreshInput: ResearchCacheRefreshInput = {
    cacheKey,
    provider,
    endpoint,
    entityType,
    entityId: resolved.id,
    source: params.source,
    query,
    path,
  };

  const entry = await selectResearchCacheEntry(cacheKey);
  if (hasUsableData(entry)) {
    if (isExpired(entry) && shouldStartRefresh(entry)) {
      await queueRefresh(refreshInput);
    }
    await recordResearchRead(params.accountId);
    return { data: entry.data };
  }

  if (shouldStartRefresh(entry)) {
    await queueRefresh(refreshInput);
  }

  return { pending: true };
}
