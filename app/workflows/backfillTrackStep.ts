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
    // A 404 means Songstats has no history for this track — terminal, so mark it
    // `done` and never retry (retrying just burns quota on a track with no data).
    // Everything else (429 quota, 5xx, timeout) is transient: mark `failed`, which
    // the daily reclaim sweep returns to `pending` for the next drain (bounded by
    // the rolling-window budget, so a persistently-failing row can't run away).
    const noData = result.status === 404;
    await insertSongstatsQuotaLedger({
      hits: 1,
      purpose: `backfill ${row.song} (${noData ? "no data 404" : `failed ${result.status}`})`,
    });
    await updateSongstatsBackfillQueue(row.id, { status: noData ? "done" : "failed" });
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
