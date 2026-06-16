import { resolveTrackIsrc } from "@/lib/research/measurements/resolveTrackIsrc";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { computePlaycountDeltas } from "@/lib/research/playcounts/computePlaycountDeltas";
import { deductCredits } from "@/lib/research/deductCredits";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GetTrackMeasurementsParams = {
  accountId: string;
  id: string;
  platform: string;
  metric: string;
  windowDays: number;
  aggregate?: "run_rate";
};

export type GetTrackMeasurementsResult = { data: unknown } | { error: string; status: number };

const NO_DATA_ERROR =
  "No measurements for this track yet — create a historical measurement-job to backfill it";

/**
 * A track's measured series from the store, or — when `aggregate=run_rate` —
 * the trailing-window annualized run-rate (a projection of the same series via
 * {@link computePlaycountDeltas}). Consolidates `track/historic-stats` and
 * `track/playcount-deltas`. 404 when the id resolves to no ISRC or no
 * measurements exist. Deducts research credits only on a successful read.
 *
 * @param params - account, provider-neutral track id, platform/metric, window
 */
export async function getTrackMeasurements(
  params: GetTrackMeasurementsParams,
): Promise<GetTrackMeasurementsResult> {
  const isrc = await resolveTrackIsrc(params.id);
  if (!isrc) return { error: "Unknown track id", status: 404 };

  const rows = await selectSongMeasurements({
    song: isrc,
    platform: params.platform,
    metric: params.metric,
  });
  if (rows.length === 0) return { error: NO_DATA_ERROR, status: 404 };

  await deductCredits(params.accountId);

  const head = {
    status: "success",
    id: params.id,
    platform: params.platform,
    metric: params.metric,
  };

  if (params.aggregate === "run_rate") {
    // window start = latest capture date minus the window
    const latestDate = rows[0].captured_at.slice(0, 10);
    const since = new Date(
      new Date(`${latestDate}T00:00:00Z`).getTime() - params.windowDays * DAY_MS,
    )
      .toISOString()
      .slice(0, 10);
    const deltas = computePlaycountDeltas(rows, { since });
    const match =
      deltas.find(d => d.platform === params.platform && d.metric === params.metric) ?? deltas[0];
    const aggregate = match
      ? {
          kind: "run_rate" as const,
          window_days: params.windowDays,
          delta: match.delta,
          run_rate_annualized: match.run_rate_annualized,
        }
      : null;
    return { data: { ...head, aggregate } };
  }

  const series = [...rows]
    .sort((a, b) => (a.captured_at < b.captured_at ? -1 : 1))
    .map(row => ({
      date: row.captured_at.slice(0, 10),
      value: row.value,
      data_source: row.data_source,
    }));

  return { data: { ...head, series } };
}
