import { chargeForBatchAnswers } from "@/lib/flamingo/chargeForBatchAnswers";
import { callMeasureSongMoments } from "@/lib/songMoments/callMeasureSongMoments";
import { chargeForSongMeasure } from "@/lib/songMoments/chargeForSongMeasure";
import { describeMoments, type DescribedMoment } from "@/lib/songMoments/describeMoments";
import type { MeasuredMoment, MeasuredSong } from "@/lib/songMoments/isMeasuredSong";
import type { MomentDescription } from "@/lib/songMoments/parseMomentDescription";
import type { SongMomentsBody, SongMomentType } from "@/lib/songMoments/songMomentsBodySchema";

/** A moment with Music Flamingo's words added when it was described. */
export type SongMoment = MeasuredMoment & Partial<MomentDescription>;

export interface SongMomentsResult extends Omit<MeasuredSong, "moments"> {
  moments: SongMoment[];
}

/**
 * Measures a song's sections and moments, then has Music Flamingo describe
 * the chosen moments in one batch, each prompt hearing a clip of just that
 * moment.
 *
 * Charges `accountId` the flat measurement price once the measurement returns,
 * and the batch once: one base price plus the seconds of the moments it
 * described. A moment the model did not describe (or every moment, when the
 * batch fails) is returned without words and is not charged. Callers verify
 * `audio_url` and gate the balance first.
 *
 * @param body - Validated request body.
 * @param context - The account the work is charged to.
 * @returns The measured song with described moments; `elapsed_seconds` is the whole request.
 * @throws Error when the measurement itself fails (nothing is charged).
 */
export async function processSongMomentsRequest(
  body: SongMomentsBody,
  context: { accountId: string },
): Promise<SongMomentsResult> {
  const started = Date.now();
  const song = await callMeasureSongMoments({
    audio_url: body.audio_url,
    ...(body.section_order ? { section_order: body.section_order } : {}),
    ...(body.tempo_hint !== undefined ? { tempo_hint: body.tempo_hint } : {}),
  });
  await chargeForSongMeasure({ accountId: context.accountId, audioUrl: body.audio_url });

  const wanted = song.moments.filter(
    moment =>
      body.describe === true ||
      (Array.isArray(body.describe) && body.describe.includes(moment.type)),
  );

  let described = new Map<SongMomentType, DescribedMoment>();
  if (wanted.length > 0) {
    try {
      described = await describeMoments({ audioUrl: body.audio_url, moments: wanted });
    } catch (error) {
      console.error("[processSongMomentsRequest] describing moments failed:", error);
    }
  }
  await chargeForBatchAnswers({
    accountId: context.accountId,
    answers: [...described.values()],
    audioUrl: body.audio_url,
  });

  const moments = song.moments.map((moment): SongMoment => {
    const words = described.get(moment.type);
    return words ? { ...moment, ...words.description } : moment;
  });

  return {
    ...song,
    moments,
    elapsed_seconds: Math.round((Date.now() - started) / 10) / 100,
  };
}
