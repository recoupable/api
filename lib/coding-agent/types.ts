/**
 * Thread state for the coding agent bot.
 * Stored in Redis via Chat SDK's state adapter.
 */
export interface CodingAgentThreadState {
  status: "running" | "pr_created" | "updating" | "failed";
  prompt: string;
  runId?: string;
  slackThreadId?: string;
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
