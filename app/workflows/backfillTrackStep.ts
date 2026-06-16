import { fetchSongstatsWithBackoff } from "@/lib/songstats/fetchSongstatsWithBackoff";
import { upsertSongMeasurements } from "@/lib/supabase/song_measurements/upsertSongMeasurements";
import { insertSongstatsQuotaLedger } from "@/lib/supabase/songstats_quota_ledger/insertSongstatsQuotaLedger";
import { updateSongstatsBackfillQueue } from "@/lib/supabase/songstats_backfill_queue/updateSongstatsBackfillQueue";
import { historicStatsPayloadSchema } from "@/lib/research/playcounts/historicStatsPayloadSchema";
import { Tables } from "@/types/database.types";

const METRIC = "platform_displayed_play_count";

/**
 * Backfill one claimed queue row, with bounded exponential backoff on Songstats'
 * rate limit (Songstats is the rate authority — see chat#1797):
 * - **200** → write each history point as a permanent `songstats` measurement,
 *   record the spend, mark `done`.
 * - **404 / other 4xx** → a real request with a definitive answer; terminal, so
 *   mark `done` (404 = no history) and record the spend.
 * - **backoff exhausted** (still 429/5xx after retries) → **defer**: leave the row
 *   `pending` for the next drain, consume no quota, and signal the workflow to
 *   stop (`deferred`) — Songstats is saturated right now.
 *
 * @param row - The claimed queue row (already in_progress)
 * @returns ok + hitsSpent (0 when deferred) + `deferred` when Songstats is saturated
 */
export async function backfillTrackStep(
  row: Tables<"songstats_backfill_queue">,
): Promise<{ ok: boolean; hitsSpent: number; deferred?: boolean }> {
  "use step";
  const result = await fetchSongstatsWithBackoff("tracks/historic_stats", {
    isrc: row.song,
    source: "spotify",
  });

  if (result.retriesExhausted) {
    // Rate-limited past the backoff bound — leave it for the next run, spend nothing.
    console.log(
      `[backfill] ${row.song} deferred (rate-limited ${result.status} after ${result.attempts} tries)`,
    );
    await updateSongstatsBackfillQueue(row.id, { status: "pending" });
    return { ok: false, hitsSpent: 0, deferred: true };
  }

  if (result.status !== 200) {
    const noData = result.status === 404;
    console.log(
      `[backfill] ${row.song} done (${noData ? "no data 404" : `terminal ${result.status}`})`,
    );
    await insertSongstatsQuotaLedger({
      hits: 1,
      purpose: `backfill ${row.song} (${noData ? "no data 404" : `terminal ${result.status}`})`,
    });
    await updateSongstatsBackfillQueue(row.id, { status: "done" });
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

  console.log(`[backfill] ${row.song} done (${rows.length} points written)`);
  await insertSongstatsQuotaLedger({ hits: 1, purpose: `backfill ${row.song}` });
  await updateSongstatsBackfillQueue(row.id, { status: "done" });
  return { ok: true, hitsSpent: 1 };
}
