import { tasks } from "@trigger.dev/sdk";
import { CREATE_CONTENT_TASK_ID } from "@/lib/const";

export interface TriggerCreateContentPayload {
  accountId: string;
  artistSlug: string;
  template?: string;
  lipsync: boolean;
  /** Controls caption length: "none" skips captions, "short", "medium", or "long". */
  captionLength: "none" | "short" | "medium" | "long";
  /** Whether to upscale image and video for higher quality. */
  upscale: boolean;
  /** GitHub repo URL so the task can fetch artist files. */
  githubRepo: string;
  /** Optional list of song slugs or public URLs. URLs are downloaded directly by the task. */
  songs?: string[];
  /** Optional list of public image URLs to use as face guides. */
  images?: string[];
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
