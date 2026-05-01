import type { CodingAgentPR } from "../types";

export interface CodingAgentPRState {
  status: "running" | "pr_created" | "updating" | "merged" | "failed" | "no_changes";
  snapshotId?: string;
  branch: string;
  repo: string;
  prs?: CodingAgentPR[];
}
