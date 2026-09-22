import { z } from "zod";
import { callContextMusicPreset } from "./callContextMusicPreset";
/** The caller supplies an authorized, expiring audio URL. Two paid calls; no retries. */
export async function analyzeContextAudio(
  audioUrl: string,
  apiKey: string,
  durationSeconds: number,
  call: typeof callContextMusicPreset = callContextMusicPreset,
) {
  z.number().positive().finite().parse(durationSeconds);
  z.url().parse(audioUrl);
  const presets = ["catalog_metadata", "lyric_transcription"] as const;
  const results = await Promise.allSettled(
    presets.map(preset =>
      call(audioUrl, preset, apiKey, { coverage: "full_duration_candidate", durationSeconds }),
    ),
  );
  return results.map((result, index) =>
    result.status === "fulfilled"
      ? { preset: presets[index], status: result.status, result: result.value }
      : {
          preset: presets[index],
          status: result.status,
          error: "Music Flamingo call failed; reconcile the attempt before retrying.",
        },
  );
}
