/**
 * Thread state for the coding agent bot.
 * Stored in Redis via Chat SDK's state adapter.
 */
export interface CodingAgentThreadState {
  status: "running" | "failed";
  prompt: string;
  runId?: string;
  slackThreadId?: string;
}
