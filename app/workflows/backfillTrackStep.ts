import { fetchSongstats } from "@/lib/songstats/fetchSongstats";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { insertSongstatsQuotaLedger } from "@/lib/supabase/songstats_quota_ledger/insertSongstatsQuotaLedger";
import { updateSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue";
import { historicStatsPayloadSchema } from "@/lib/research/playcounts/historicStatsPayloadSchema";
import { Tables } from "@/types/database.types";

const METRIC = "platform_displayed_play_count";

/**
 * Backfill one claimed queue row: fetch the track's Songstats historic series
 * (one quota hit — recorded win or lose), write each point as a permanent
 * `songstats`-labeled measurement, and close the row. Failures mark the row
 * failed without failing the run — the next row may still succeed.
 *
 * @param row - The claimed queue row (already in_progress)
 * @returns ok + hits spent (always 1; the hit is consumed even on failure)
 */
export async function backfillTrackStep(
  row: Tables<"songstats_backfill_queue">,
): Promise<{ ok: boolean; hitsSpent: number }> {
  "use step";
  const result = await fetchSongstats("tracks/historic_stats", {
    isrc: row.song,
    source: "spotify",
  });

  if (result.status !== 200) {
    const status = result.status;
    const isNoData = status === 404;
    // Only transient errors are retryable: 408 (timeout), 429 (quota), any 5xx.
    const isRetryable = status === 408 || status === 429 || status >= 500;

    // `failed` is reclaimable (the daily sweep returns it to `pending`, bounded
    // by the rolling-window budget). 404 no-data and other permanent 4xx are
    // terminal → `done`, so reclaim never recycles a track that can't succeed.
    const nextStatus = isRetryable ? "failed" : "done";

    let outcome = `terminal ${status}`;
    if (isNoData) outcome = "no data 404";
    else if (isRetryable) outcome = `failed ${status}`;

    await insertSongstatsQuotaLedger({ hits: 1, purpose: `backfill ${row.song} (${outcome})` });
    await updateSongstatsBackfillQueue(row.id, { status: nextStatus });
    return { ok: false, hitsSpent: 1 };
  }

  const parsed = historicStatsPayloadSchema.safeParse(result.data);
  const history = parsed.success
    ? (parsed.data.stats?.find(s => s.source === "spotify")?.data?.history ?? [])
    : [];

  const rows = history.flatMap(point => {
    const value = (point as Record<string, unknown>).streams_total;
    if (!point.date || typeof value !== "number") return [];
    return [
      {
        song: row.song,
        platform: "spotify",
        metric: METRIC,
        value,
        captured_at: new Date(`${point.date}T00:00:00Z`).toISOString(),
        data_source: "songstats",
        raw_ref: "songstats-backfill",
      },
    ];
  });
  await upsertSongMeasurements(rows);

  await insertSongstatsQuotaLedger({ hits: 1, purpose: `backfill ${row.song}` });
  await updateSongstatsBackfillQueue(row.id, { status: "done" });
  return { ok: true, hitsSpent: 1 };
}
