import {
  validateCatalogPlaycountHistoryQuery,
  type CatalogPlaycountHistoryQuery,
} from "./validateCatalogPlaycountHistoryQuery";
import { getCatalogOwnerIds } from "./getCatalogOwnerIds";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogRecordingPage } from "@/lib/supabase/catalog_songs/selectCatalogRecordingPage";
import { selectCatalogStreamObservations } from "@/lib/supabase/catalog_stream_observations/selectCatalogStreamObservations";
import { selectLatestCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/selectLatestCatalogStreamRun";
import { compareSpotifyDailyStreams } from "./compareSpotifyDailyStreams";

/** Read source-reported calendar-day streams, keeping provider identities and missing dates separate. */
export async function getCatalogStreams(accountId: string, input: CatalogPlaycountHistoryQuery) {
  const parsed = validateCatalogPlaycountHistoryQuery(input);
  if (!parsed.success) return { error: "Invalid stream history query", status: 400 } as const;
  const q = parsed.data;
  const boundary = Date.parse(q.since);
  const since = new Date(boundary - q.days * 86400000).toISOString().slice(0, 10);
  const until = new Date(boundary + q.days * 86400000).toISOString().slice(0, 10);
  if (until > new Date().toISOString().slice(0, 10))
    return { error: "Comparison requires completed UTC days", status: 400 } as const;
  if (
    !(await selectAccountCatalog({
      accountIds: await getCatalogOwnerIds(accountId),
      catalogId: q.catalog_id,
      throwOnError: true,
    }))
  )
    return { error: "Catalog not found", status: 404 } as const;
  const page = await selectCatalogRecordingPage({
    catalogId: q.catalog_id,
    page: q.page,
    limit: q.limit,
  });
  const latestRun = await selectLatestCatalogStreamRun(q.catalog_id);
  const coverage = latestRun?.coverage;
  const observations = new Map<
    string,
    Awaited<ReturnType<typeof selectCatalogStreamObservations>>
  >();
  // Bounded parallel reads preserve the SQL per-recording limit and avoid serial page latency.
  for (let offset = 0; offset < page.songs.length; offset += 5) {
    await Promise.all(
      page.songs.slice(offset, offset + 5).map(async song => {
        observations.set(
          song.isrc,
          await selectCatalogStreamObservations({
            catalogId: q.catalog_id,
            isrc: song.isrc,
            since,
            until,
          }),
        );
      }),
    );
  }
  const recordings = [];
  for (const song of page.songs) {
    const versions = (observations.get(song.isrc) ?? []).sort(
      (a, b) =>
        b.retrieved_at.localeCompare(a.retrieved_at) ||
        (b.run_id ?? "").localeCompare(a.run_id ?? ""),
    );
    const latest = new Map<string, (typeof versions)[number]>();
    for (const row of versions) if (!latest.has(row.date)) latest.set(row.date, row);
    const identity = versions[0]?.provider_recording_id ?? null;
    const days = [...latest.values()]
      .filter(row => row.provider_recording_id === identity)
      .map(row => ({ date: row.date, streams: row.streams }));
    recordings.push({
      ...song,
      latest_attempt:
        coverage && typeof coverage === "object" && !Array.isArray(coverage)
          ? (coverage[song.isrc] ?? null)
          : null,
      provider_recording_id: identity,
      retrieved_at: versions[0]?.retrieved_at ?? null,
      days,
      ...compareSpotifyDailyStreams(
        days.filter((row): row is { date: string; streams: number } => row.streams !== null),
        { since: q.since, days: q.days },
        new Date(),
      ),
    });
  }
  return {
    data: {
      catalog_id: q.catalog_id,
      provider: "luminate",
      platform: "all_dsps",
      territory: "worldwide",
      metric: "daily_streams",
      semantics:
        "Source-reported daily aggregate streams across reporting services; not Spotify-only or royalty statements",
      source_updated_at: null,
      latest_run: latestRun,
      periods: {
        previous: { start: since, end_exclusive: q.since },
        current: { start: q.since, end_exclusive: until },
        days: q.days,
        timezone: "UTC",
      },
      pagination: {
        page: q.page,
        limit: q.limit,
        total_count: page.total_count,
        has_more: q.page * q.limit < page.total_count,
      },
      summary_scope: "page",
      recordings,
    },
  } as const;
}
