import { getAlbumPlaycounts } from "@/lib/research/playcounts/getAlbumPlaycounts";

const METRIC = "platform_displayed_play_count";

export type GetAlbumMeasurementsResult = { data: unknown } | { error: string; status: number };

type PlaycountRow = {
  isrc: string;
  spotify_track_id: string | null;
  name: string | null;
  platform_displayed_play_count: number;
  captured_at: string;
  data_source: string;
};

/**
 * Latest measured count per track on an album, in the `measurements` shape —
 * a thin remap over {@link getAlbumPlaycounts} (which serves the store and
 * deducts credits). Consolidates `GET /api/research/playcounts`.
 *
 * @param params.accountId - The authenticated account
 * @param params.spotifyAlbumId - The Spotify album id
 */
export async function getAlbumMeasurements(params: {
  accountId: string;
  spotifyAlbumId: string;
}): Promise<GetAlbumMeasurementsResult> {
  const result = await getAlbumPlaycounts(params);
  if ("error" in result) return result;

  const { playcounts } = result.data as { playcounts: PlaycountRow[] };
  const measurements = playcounts.map(p => ({
    isrc: p.isrc,
    spotify_track_id: p.spotify_track_id,
    name: p.name,
    value: p.platform_displayed_play_count,
    captured_at: p.captured_at,
    data_source: p.data_source,
  }));

  return {
    data: {
      status: "success",
      id: params.spotifyAlbumId,
      platform: "spotify",
      metric: METRIC,
      measurements,
    },
  };
}
