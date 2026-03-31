import { tasks } from "@trigger.dev/sdk";
import { CREATE_CONTENT_TASK_ID } from "@/lib/const";

export interface TriggerCreateContentPayload {
  accountId: string;
  artistSlug: string;
  template: string;
  lipsync: boolean;
  /** Controls caption length: "short", "medium", or "long". */
  captionLength: "short" | "medium" | "long";
  /** Whether to upscale image and video for higher quality. */
  upscale: boolean;
  /** GitHub repo URL so the task can fetch artist files. */
  githubRepo: string;
  /** Optional list of song slugs to restrict which songs the pipeline picks from. */
  songs?: string[];
  /** Public URL of a user-attached audio file to use instead of selecting from Git songs. */
  attachedAudioUrl?: string;
  /** Public URL of a user-attached image to use as the face guide instead of the repo face-guide.png. */
  attachedImageUrl?: string;
}

/**
 * Triggers the create-content task in Trigger.dev.
 *
 * @param payload
 */
export async function triggerCreateContent(payload: TriggerCreateContentPayload) {
  const handle = await tasks.trigger(CREATE_CONTENT_TASK_ID, payload);
  return handle;
}
