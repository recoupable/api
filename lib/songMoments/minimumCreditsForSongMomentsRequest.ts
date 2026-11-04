import { FLAMINGO_BASE_CREDITS } from "@/lib/flamingo/creditsForFlamingoCall";
import { SONG_MEASURE_CREDITS } from "@/lib/songMoments/songMeasureCredits";
import { SONG_MOMENT_TYPES, type SongMomentsBody } from "@/lib/songMoments/songMomentsBodySchema";

/**
 * The pre-flight credit gate for a song-moments request: the measurement
 * price plus one model base fee for every moment that might be described.
 * A song has at most one moment of each type, so that bounds the calls.
 *
 * @param body - The validated request; only `describe` matters.
 * @returns Credits the account must hold before anything runs.
 */
export function minimumCreditsForSongMomentsRequest(
  body: Pick<SongMomentsBody, "describe">,
): number {
  const calls =
    body.describe === true
      ? SONG_MOMENT_TYPES.length
      : body.describe === false
        ? 0
        : body.describe.length;
  return SONG_MEASURE_CREDITS + calls * FLAMINGO_BASE_CREDITS;
}
