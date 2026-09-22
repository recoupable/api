import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import {
  buildSpotifyHistoricStat,
  type SpotifyHistoricStat,
} from "@/lib/research/playcounts/buildSpotifyHistoricStat";
import { deductCredits } from "@/lib/research/deductCredits";

const METRIC = "platform_displayed_play_count";

export type GetTrackHistoricStatsParams = {
  accountId: string;
  isrc: string;
  startDate?: string;
  endDate?: string;
  /** Billing endpoint label written to `usage_events.model_id`. */
  modelId?: string;
};

export type GetTrackHistoricStatsResult =
  | { data: { result: "success"; stats: SpotifyHistoricStat[] } }
  | { error: string; status: number };

export const NO_MEASUREMENTS_ERROR =
  "No measurements for this track yet — create a current measurement job to capture it";

/**
 * Historic Spotify series for one recording, served from the measurement
 * store only (recoupable/chat#1791): every capture the store holds, one point
 * per date, optionally bounded by the request's date window. Credits are
 * deducted only when at least one measurement exists.
 *
 * @param params - The account, the recording's ISRC, the window and the billing label
 */
export async function getTrackHistoricStatsApifyFirst(
  params: GetTrackHistoricStatsParams,
): Promise<GetTrackHistoricStatsResult> {
  const rows = await selectSongMeasurements({
    song: params.isrc,
    platform: "spotify",
    metric: METRIC,
  });
  if (rows.length === 0) return { error: NO_MEASUREMENTS_ERROR, status: 404 };

  const stat = buildSpotifyHistoricStat(rows, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  await deductCredits(params.accountId, params.modelId);
  return { data: { result: "success", stats: [stat] } };
}
