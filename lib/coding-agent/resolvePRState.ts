import type { Thread } from "chat";
import { getCodingAgentPRState, type CodingAgentPRState } from "./prState";
import type { CodingAgentThreadState } from "./types";

export interface PRContext {
  repo?: string;
  branch?: string;
}

/**
 * Resolves the coding agent state from either the thread state or the shared PR state key.
 * When a GitHub PR comment triggers onNewMention, the thread may not have state yet,
 * but we can look up the shared key using repo/branch from the PR webhook context.
 *
 * @param thread - The chat thread
 * @param prContext - Optional PR context with repo/branch (from GitHub webhook)
 * @returns The thread state (preferred) or shared PR state, or null
 */
export async function resolvePRState(
  thread: Thread<CodingAgentThreadState>,
  prContext?: PRContext,
): Promise<CodingAgentThreadState | null> {
  const threadState = await thread.state;
  if (threadState) return threadState;

  if (prContext?.repo && prContext?.branch) {
    const prState = await getCodingAgentPRState(prContext.repo, prContext.branch);
    if (prState) {
      return {
        status: prState.status,
        prompt: "",
        branch: prState.branch,
        snapshotId: prState.snapshotId,
        prs: prState.prs,
      };
    }
  }

  return null;
}
