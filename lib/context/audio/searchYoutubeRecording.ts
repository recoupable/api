import { z } from "zod";
import {
  recordingSchema,
  youtubeCandidateSchema,
  type Recording,
  type AudioCommand,
} from "./types";
import { runAudioCommand } from "./runAudioCommand";
/** Search is evidence discovery, not proof that an upload is the same recording. */
export async function searchYoutubeRecording(
  input: Recording,
  run: AudioCommand = runAudioCommand,
) {
  const recording = recordingSchema.parse(input);
  const query = [recording.title, ...recording.artists, "official audio"].join(" ");
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const args = [
    "--ignore-config",
    "--no-playlist",
    "--skip-download",
    "--flat-playlist",
    "--dump-single-json",
    "--socket-timeout",
    "20",
    "--extractor-retries",
    "0",
    "--retries",
    "0",
    "--",
    `ytsearch5:${query}`,
  ];
  const raw = JSON.parse(await run("yt-dlp", args));
  const response = z.object({ entries: z.array(z.unknown()) }).parse(raw);
  const candidates = response.entries.flatMap(entry => {
    const parsed = youtubeCandidateSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    query,
    candidates,
    rawResponse: raw,
    startedAt,
    elapsedMs: Date.now() - start,
    executor: "yt-dlp",
    args,
    rejectedEntries: response.entries.length - candidates.length,
  };
}
