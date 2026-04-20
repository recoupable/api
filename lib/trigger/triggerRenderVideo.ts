import { tasks } from "@trigger.dev/sdk";

/** Payload sent to the Trigger.dev render-video task. */
export type RenderVideoPayload = {
  compositionId: string;
  inputProps: Record<string, unknown>;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  codec: "h264" | "h265" | "vp8" | "vp9";
  accountId: string;
};

/**
 * Triggers the render-video background task on Trigger.dev.
 *
 * The task bundles the composition, renders the video, uploads it to
 * Supabase storage, and returns the video URL. Poll via
 * GET /api/tasks/runs?runId=<handle.id> to check status.
 *
 * @param payload - Composition config + account info for the render.
 * @returns The task handle with runId.
 */
export async function triggerRenderVideo(payload: RenderVideoPayload) {
  const handle = await tasks.trigger("render-video", payload);
  return handle;
}
