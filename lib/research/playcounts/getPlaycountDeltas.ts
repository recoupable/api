import { selectSongs } from "@/lib/supabase/songs/selectSongs";
import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";
import { computePlaycountDeltas } from "@/lib/research/playcounts/computePlaycountDeltas";
import { deductCredits } from "@/lib/research/deductCredits";

export type GetPlaycountDeltasResult = { data: unknown } | { error: string; status: number };

/**
 * Play-count change between snapshots for one recording, with an annualized
 * run-rate, served from the measurement store. Insufficient history returns
 * an empty `deltas` array (never an error); an ISRC not in the songs table
 * is a 404. Deducts research credits only on a successful read.
 *
 * @param params.accountId - The authenticated account
 * @param params.isrc - The recording's ISRC
 * @param params.since - Window start (YYYY-MM-DD)
 * @param params.until - Optional window end (YYYY-MM-DD)
 */
export async function getPlaycountDeltas(params: {
  accountId: string;
  isrc: string;
  since: string;
  until?: string;
}): Promise<GetPlaycountDeltasResult> {
  const songs = await selectSongs([params.isrc]);
  if (songs.length === 0) return { error: "Unknown ISRC", status: 404 };

  const rows = await selectSongMeasurements({ song: params.isrc });
  const deltas = computePlaycountDeltas(rows, { since: params.since, until: params.until });

  await deductCredits(params.accountId);

  return { data: { status: "success", isrc: params.isrc, deltas } };
}
