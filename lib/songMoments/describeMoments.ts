import { callFlamingoGenerateBatch } from "@/lib/flamingo/callFlamingoGenerateBatch";
import type { MeasuredMoment } from "@/lib/songMoments/isMeasuredSong";
import {
  parseMomentDescription,
  type MomentDescription,
} from "@/lib/songMoments/parseMomentDescription";
import type { SongMomentType } from "@/lib/songMoments/songMomentsBodySchema";

const MOMENT_DESCRIPTION_PROMPT = `You are hearing a short clip cut from a song, for music licensing. Describe only this clip. Return ONLY a JSON object with double quotes: {"description": one sentence on what happens musically in the clip, "emotion": up to 3 mood words, "vocals": true or false, "best_for": up to 3 uses chosen from ["film trailer", "TV promo", "ad", "social video", "video game", "sports", "documentary", "end credits"]}. No other text.`;

const MAX_NEW_TOKENS = 256;

/** One moment's words, and the model seconds they took (for billing). */
export interface DescribedMoment {
  description: MomentDescription;
  elapsed_seconds: number;
}

/**
 * Has Music Flamingo describe every given moment in ONE batch: the song is
 * downloaded once and each prompt hears only its own moment's clip, cut on
 * the model's side. The times come from the audio measurement; the model
 * only supplies words, never times.
 *
 * An answer counts only when it echoes the clip it was asked about, so a
 * description can never come from the whole song (for example from a model
 * service that does not cut clips yet).
 *
 * @param params - The song's audio URL and the moments to describe (at most
 *   one of each type, so the type is each prompt's id).
 * @returns The described moments' words and seconds, keyed by moment type;
 *   a moment the model did not answer for is absent.
 * @throws When the batch call fails (nothing to charge for).
 */
export async function describeMoments(params: {
  audioUrl: string;
  moments: Pick<MeasuredMoment, "type" | "start" | "end">[];
}): Promise<Map<SongMomentType, DescribedMoment>> {
  const result = await callFlamingoGenerateBatch({
    audio_url: params.audioUrl,
    prompts: params.moments.map(moment => ({
      id: moment.type,
      prompt: MOMENT_DESCRIPTION_PROMPT,
      max_new_tokens: MAX_NEW_TOKENS,
      clip: { start: moment.start, end: moment.end },
    })),
    temperature: 1.0,
    top_p: 1.0,
    do_sample: false,
  });

  const described = new Map<SongMomentType, DescribedMoment>();
  for (const moment of params.moments) {
    const answer = result.answers.find(a => a.id === moment.type);
    if (!answer || answer.clip_start !== moment.start || answer.clip_end !== moment.end) continue;
    described.set(moment.type, {
      description: parseMomentDescription(answer.response),
      elapsed_seconds: answer.elapsed_seconds,
    });
  }
  return described;
}
