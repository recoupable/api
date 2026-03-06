/**
 * Thread state for the coding agent bot.
 * Stored in Redis via Chat SDK's state adapter.
 */
export interface CodingAgentThreadState {
  status: "running" | "pr_created" | "updating" | "merged" | "failed";
  prompt: string;
  runId?: string;
  sandboxId?: string;
  snapshotId?: string;
  branch?: string;
  prs?: CodingAgentPR[];
  slackThreadId?: string;
}

export interface CodingAgentPR {
  repo: string;
  number: number;
  url: string;
  baseBranch: string;
}
