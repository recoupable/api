import { deleteCodingAgentPRState } from "./prState";
import type { CodingAgentThreadState } from "./types";

/**
 * Handles post-merge cleanup after all PRs merged successfully.
 * Deletes the shared PR state keys for all repos.
 *
 * @param state
 */
export async function handleMergeSuccess(state: CodingAgentThreadState): Promise<void> {
  try {
    if (state.branch && state.prs?.length) {
      const repos = [...new Set(state.prs.map(pr => pr.repo))];
      await Promise.all(repos.map(repo => deleteCodingAgentPRState(repo, state.branch!)));
    }
  } catch (error) {
    console.error("[coding-agent] post-merge cleanup failed:", error);
  }
}
