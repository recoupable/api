import fal from "@/lib/fal/server";
import { MUSIC_MODEL } from "@/lib/music/const";

export type MusicQueueState = "queued" | "running" | "completed";

/**
 * Ask fal whether a queued generation has finished.
 *
 * Normalizes fal's queue vocabulary the way `normalizeRunStatus` does for
 * Workflow runs: an unrecognized value reads as still running, never as a
 * terminal state we would act on.
 *
 * @param requestId - fal's request id from the submit step.
 * @returns The normalized queue state.
 */
export async function pollMusicGenerationStep(requestId: string): Promise<MusicQueueState> {
  "use step";
  const status = await fal.queue.status(MUSIC_MODEL, { requestId });

  switch (status.status) {
    case "COMPLETED":
      return "completed";
    case "IN_QUEUE":
      return "queued";
    default:
      return "running";
  }
}
