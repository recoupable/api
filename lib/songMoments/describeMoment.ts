import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import {
  parseMomentDescription,
  type MomentDescription,
} from "@/lib/songMoments/parseMomentDescription";

const MOMENT_DESCRIPTION_PROMPT = `You are hearing a short clip cut from a song, for music licensing. Describe only this clip. Return ONLY a JSON object with double quotes: {"description": one sentence on what happens musically in the clip, "emotion": up to 3 mood words, "vocals": true or false, "best_for": up to 3 uses chosen from ["film trailer", "TV promo", "ad", "social video", "video game", "sports", "documentary", "end credits"]}. No other text.`;

const MAX_NEW_TOKENS = 256;

/**
 * Has Music Flamingo listen to one moment, cut from the song on the model's
 * side, and describe it. The times come from the audio measurement; the model
 * only supplies words, never times.
 *
 * @param params - The song's audio URL and the moment's start and end in seconds.
 * @returns The parsed description and the model's reported seconds, for billing.
 * @throws Error when the model call fails (nothing to charge for).
 */
export async function describeMoment(params: {
  audioUrl: string;
  start: number;
  end: number;
}): Promise<{ description: MomentDescription; elapsed_seconds: number }> {
  const result = await callFlamingoGenerate(
    {
      prompt: MOMENT_DESCRIPTION_PROMPT,
      audio_url: params.audioUrl,
      max_new_tokens: MAX_NEW_TOKENS,
      temperature: 1.0,
      top_p: 1.0,
      do_sample: false,
    },
    { clip: { start: params.start, end: params.end } },
  );
  return {
    description: parseMomentDescription(result.response),
    elapsed_seconds: result.elapsed_seconds,
  };
}
