import { normalizeContextAudio } from "./normalizeContextAudio";
import { searchYoutubeRecording } from "./searchYoutubeRecording";
import { matchYoutubeRecording } from "./matchYoutubeRecording";
import { downloadYoutubeAudio } from "./downloadYoutubeAudio";
import type { Recording } from "./types";
/** Worker orchestration. Caller supplies authenticated storage; this module never makes an asset public. */
export async function acquireContextYoutubeAudio(
  recording: Recording,
  deps: {
    search?: typeof searchYoutubeRecording;
    download?: typeof downloadYoutubeAudio;
    normalize?: typeof normalizeContextAudio;
    save: (
      asset: Awaited<ReturnType<typeof normalizeContextAudio>>,
    ) => Promise<{ assetId: string }>;
  },
) {
  const steps: Array<{ name: string; status: string; result: unknown }> = [];
  let stage = "Search YouTube";
  try {
    const search = await (deps.search ?? searchYoutubeRecording)(recording);
    steps.push({ name: stage, status: "complete", result: search });
    stage = "Match recording";
    const match = matchYoutubeRecording(recording, search.candidates);
    steps.push({ name: stage, status: match.status, result: match });
    if (!match.selected) return { status: "needs_review", asset: null, steps };
    stage = "Download and check audio";
    const downloaded = await (deps.download ?? downloadYoutubeAudio)(
      match.selected.id,
      recording.durationSeconds,
    );
    steps.push({ name: stage, status: "complete", result: downloaded.trace });
    stage = "Normalize audio to WAV";
    const normalized = await (deps.normalize ?? normalizeContextAudio)(
      downloaded.bytes,
      downloaded.trace.durationSeconds,
    );
    steps.push({ name: stage, status: "complete", result: normalized.trace });
    stage = "Save audio";
    const asset = await deps.save(normalized);
    steps.push({ name: stage, status: "complete", result: asset });
    return { status: "acquired", asset, steps };
  } catch (error) {
    steps.push({
      name: stage,
      status: "failed",
      result: { error: error instanceof Error ? error.message : "Audio acquisition failed" },
    });
    return { status: "failed", asset: null, steps };
  }
}
