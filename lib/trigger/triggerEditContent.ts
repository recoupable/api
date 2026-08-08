import { tasks } from "@trigger.dev/sdk";

interface EditOperation {
  [key: string]: unknown;
  type: string;
}

export interface TriggerEditContentPayload {
  accountId: string;
  video_url: string;
  operations: EditOperation[];
  output_format?: string;
}

/**
 * Triggers the ffmpeg-edit task in Trigger.dev to apply edit operations
 * to an existing video.
 *
 * @param payload - The edit payload with video URL and operations.
 * @returns The task handle with runId.
 */
export async function triggerEditContent(payload: TriggerEditContentPayload) {
  const handle = await tasks.trigger("ffmpeg-edit", {
    ...payload,
    output_format: payload.output_format ?? "mp4",
  });
  return handle;
}
