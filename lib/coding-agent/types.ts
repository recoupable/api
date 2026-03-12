/**
 * Thread state for the coding agent bot.
 * Stored in Redis via Chat SDK's state adapter.
 */
export interface CodingAgentThreadState {
  status: "running" | "pr_created" | "updating" | "merged" | "failed" | "no_changes";
  prompt: string;
  runId?: string;
  /** @deprecated Use threadId instead. Kept for backwards compatibility with existing Redis state. */
  slackThreadId?: string;
  /** Platform-agnostic thread identifier (Slack or WhatsApp thread ID). */
  threadId?: string;
  branch?: string;
  snapshotId?: string;
  prs?: CodingAgentPR[];
}

export interface CodingAgentPR {
  repo: string;
  number: number;
  url: string;
  baseBranch: string;
}
