import { getSpotifyStatFromStore } from "@/lib/research/playcounts/getSpotifyStatFromStore";
import type { SpotifyStoreStat } from "@/lib/research/playcounts/toStat";
import { deductCredits } from "@/lib/research/deductCredits";

export type GetTrackStatsParams = {
  accountId: string;
  isrc: string;
  /** Billing endpoint label written to `usage_events.model_id`. */
  modelId?: string;
};

export type GetTrackStatsResult =
  | { data: { result: "success"; stats: SpotifyStoreStat[] } }
  | { error: string; status: number };

export const NO_STORED_CAPTURE_ERROR =
  "No stored capture for this ISRC — create a current measurement job first";

/**
 * Per-track current Spotify stats served from the Apify-backed measurement
 * store (recoupable/chat#1791). A fresh capture is returned as-is; a stale or
 * missing one is refreshed through the album actor inside
 * {@link getSpotifyStatFromStore}. Credits are deducted only when the store
 * answers.
 *
 * @param params - The account, the recording's ISRC and the billing label
 */
export async function getTrackStatsApifyFirst(
  params: GetTrackStatsParams,
): Promise<GetTrackStatsResult> {
  const stat = await getSpotifyStatFromStore(params.isrc);
  if (!stat) return { error: NO_STORED_CAPTURE_ERROR, status: 404 };

  await deductCredits(params.accountId, params.modelId);
  return { data: { result: "success", stats: [stat] } };
}
