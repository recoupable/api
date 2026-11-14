import { FLAMINGO_BASE_CREDITS } from "@/lib/flamingo/creditsForFlamingoCall";
import { SONG_MEASURE_CREDITS } from "@/lib/songMoments/songMeasureCredits";
import type { SongMomentsBody } from "@/lib/songMoments/songMomentsBodySchema";

/**
 * The pre-flight credit gate for a song-moments request: the measurement
 * price plus one model base fee when any moment may be described, since
 * every described moment rides in the same batch.
 *
 * @param body - The validated request; only `describe` matters.
 * @returns Credits the account must hold before anything runs.
 */
export function minimumCreditsForSongMomentsRequest(
  body: Pick<SongMomentsBody, "describe">,
): number {
  const describes =
    body.describe === true || (Array.isArray(body.describe) && body.describe.length > 0);
  return SONG_MEASURE_CREDITS + (describes ? FLAMINGO_BASE_CREDITS : 0);
}
