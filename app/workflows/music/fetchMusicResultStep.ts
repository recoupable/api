import fal from "@/lib/fal/server";
import { MUSIC_MODEL } from "@/lib/music/const";

export type MusicResult = {
  audioUrl: string;
  seed: number | null;
  durationSeconds: number | null;
  fileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
};

/**
 * Collect a finished generation's audio from fal.
 *
 * @param requestId - fal's request id.
 * @returns The audio url plus the parameters fal actually used.
 * @throws Error when the result carries no audio, which is a failed generation
 *   fal reported as complete.
 */
export async function fetchMusicResultStep(requestId: string): Promise<MusicResult> {
  "use step";
  const result = await fal.queue.result(MUSIC_MODEL, { requestId });
  const data = result.data as Record<string, unknown>;
  const audio = data?.audio as Record<string, unknown> | undefined;
  const audioUrl = audio?.url as string | undefined;

  if (!audioUrl) {
    throw new Error("Music generation returned no audio");
  }

  return {
    audioUrl,
    seed: typeof data.seed === "number" ? data.seed : null,
    durationSeconds: typeof data.duration === "number" ? data.duration : null,
    fileName: typeof audio?.file_name === "string" ? audio.file_name : null,
    contentType: typeof audio?.content_type === "string" ? audio.content_type : null,
    fileSizeBytes: typeof audio?.file_size === "number" ? audio.file_size : null,
  };
}
