import { getCatalogOwnerIds } from "./getCatalogOwnerIds";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogRecordingPage } from "@/lib/supabase/catalog_songs/selectCatalogRecordingPage";
import { selectPublicPlaycountHistory } from "@/lib/supabase/song_measurements/selectPublicPlaycountHistory";
import { compareCatalogPlaycountHistory } from "./compareCatalogPlaycountHistory";
import {
  validateCatalogPlaycountHistoryQuery,
  type CatalogPlaycountHistoryQuery,
} from "./validateCatalogPlaycountHistoryQuery";

/**
 * Shared authenticated catalog history read for HTTP and MCP. Catalog authorization is refreshed
 * each call; measurements are public cumulative observations, with no provider calls or charges.
 * @param accountId - Identity derived from validated credentials.
 * @param input - Bounded comparison and page input.
 */
export async function getCatalogPlaycountHistory(
  accountId: string,
  input: CatalogPlaycountHistoryQuery,
) {
  const parsed = validateCatalogPlaycountHistoryQuery(input);
  if (!parsed.success) return { error: "Invalid comparison query", status: 400 } as const;
  const query = parsed.data;
  const day = 86_400_000;
  const boundary = Date.parse(`${query.since}T00:00:00Z`);
  const since = new Date(boundary - query.days * day).toISOString().slice(0, 10);
  const until = new Date(boundary + query.days * day).toISOString().slice(0, 10);
  // All boundary observation dates must have finished, not just the calendar period being compared.
  if (until >= new Date().toISOString().slice(0, 10)) {
    return { error: "Comparison requires completed UTC observation days", status: 400 } as const;
  }
  const ownerIds = await getCatalogOwnerIds(accountId);
  const link = await selectAccountCatalog({
    accountIds: ownerIds,
    catalogId: query.catalog_id,
    throwOnError: true,
  });
  if (!link) return { error: "Catalog not found", status: 404 } as const;
  const page = await selectCatalogRecordingPage({
    catalogId: query.catalog_id,
    page: query.page,
    limit: query.limit,
  });
  const recordings: ({ isrc: string; name: string | null } & ReturnType<
    typeof compareCatalogPlaycountHistory
  >)[] = [];
  // Five concurrent store reads, at most 25 recordings per request. No vendor traffic.
  for (let i = 0; i < page.songs.length; i += 5) {
    const batch = await Promise.all(
      page.songs.slice(i, i + 5).map(async song => ({
        ...song,
        ...compareCatalogPlaycountHistory(
          await selectPublicPlaycountHistory({ song: song.isrc, since, until }),
          query,
        ),
      })),
    );
    recordings.push(...batch);
  }
  return {
    data: {
      catalog_id: query.catalog_id,
      platform: "spotify",
      metric: "platform_displayed_play_count",
      data_source: "apify_spotify_playcount",
      semantics:
        "Change between cumulative public observations, not exact calendar-day streams or royalty statements",
      source_timestamp_available: false,
      provider_identity_available: false,
      comparison_quality: "legacy_recording_series_identity_unverified",
      missing_observation_reason_available: false,
      collection_enabled: false,
      periods: {
        previous: { start: since, end: query.since },
        current: { start: query.since, end: until },
        days: query.days,
        timezone: "UTC",
        boundary_semantics: "Latest observation on each boundary date",
        alignment_tolerance_seconds: 3600,
      },
      pagination: {
        page: query.page,
        limit: query.limit,
        total_count: page.total_count,
        total_pages: Math.ceil(page.total_count / query.limit),
        has_more: query.page * query.limit < page.total_count,
      },
      summary_scope: "page",
      comparable_recordings: recordings.filter(row => row.state === "comparable").length,
      recordings,
    },
  } as const;
}
