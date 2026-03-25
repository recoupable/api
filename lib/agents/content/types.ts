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
}
