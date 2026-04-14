/**
 * Thread state for the content agent bot.
 * Stored in Redis via Chat SDK's state adapter.
 */
export interface ContentAgentThreadState {
  status: "running" | "completed" | "failed" | "timeout";
  artistAccountId: string;
  template: string;
  lipsync: boolean;
  batch: number;
  runIds: string[];
  /** URLs of successfully generated videos, stored on completion for edit flows. */
  videoUrls?: string[];
  /** URLs of successfully generated images, stored on completion for edit flows. */
  imageUrls?: string[];
}
