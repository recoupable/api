import { chargeForFlamingoCall } from "@/lib/flamingo/chargeForFlamingoCall";
import { callMeasureSongMoments } from "@/lib/songMoments/callMeasureSongMoments";
import { chargeForSongMeasure } from "@/lib/songMoments/chargeForSongMeasure";
import { describeMoment } from "@/lib/songMoments/describeMoment";
import type { MeasuredMoment, MeasuredSong } from "@/lib/songMoments/isMeasuredSong";
import type { MomentDescription } from "@/lib/songMoments/parseMomentDescription";
import type { SongMomentsBody } from "@/lib/songMoments/songMomentsBodySchema";

/** A moment with Music Flamingo's words added when it was described. */
export type SongMoment = MeasuredMoment & Partial<MomentDescription>;

export interface SongMomentsResult extends Omit<MeasuredSong, "moments"> {
  moments: SongMoment[];
}

/**
 * Measures a song's sections and moments, then has Music Flamingo describe
 * the chosen moments, each from a clip of just that moment.
 *
 * Charges `accountId` the flat measurement price once the measurement returns,
 * and each model call on its own reported seconds, like /api/songs/analyze.
 * A moment whose description fails is returned without words and is not
 * charged. Callers verify `audio_url` and gate the balance first.
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
  });
  await chargeForSongMeasure({ accountId: context.accountId, audioUrl: body.audio_url });

  const wanted = (moment: MeasuredMoment) =>
    body.describe === true || (Array.isArray(body.describe) && body.describe.includes(moment.type));

  const moments = await Promise.all(
    song.moments.map(async (moment): Promise<SongMoment> => {
      if (!wanted(moment)) return moment;
      try {
        const { description, elapsed_seconds } = await describeMoment({
          audioUrl: body.audio_url,
          start: moment.start,
          end: moment.end,
        });
        await chargeForFlamingoCall({
          accountId: context.accountId,
          elapsedSeconds: elapsed_seconds,
          audioUrl: body.audio_url,
        });
        return { ...moment, ...description };
      } catch (error) {
        console.error(`[processSongMomentsRequest] describing ${moment.type} failed:`, error);
        return moment;
      }
    }),
  );

  return {
    ...song,
    moments,
    elapsed_seconds: Math.round((Date.now() - started) / 10) / 100,
  };
}
