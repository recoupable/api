import { deleteCodingAgentPRState } from "./prState";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { RECOUP_ORG_ID, SNAPSHOT_EXPIRY_MS } from "@/lib/const";
import type { CodingAgentThreadState } from "./types";

/**
 * Handle Merge Success.
 *
 * @param state - Value for state.
 * @returns - Computed result.
 */
export async function handleMergeSuccess(state: CodingAgentThreadState): Promise<void> {
  try {
    if (state.branch && state.prs?.length) {
      const repos = [...new Set(state.prs.map(pr => pr.repo))];
      await Promise.all(repos.map(repo => deleteCodingAgentPRState(repo, state.branch!)));
    }

    if (state.snapshotId) {
      const snapshotResult = await upsertAccountSnapshot({
        account_id: RECOUP_ORG_ID,
        snapshot_id: state.snapshotId,
        expires_at: new Date(Date.now() + SNAPSHOT_EXPIRY_MS).toISOString(),
      });

      if (snapshotResult.error) {
        console.error(
          `[coding-agent] failed to persist snapshot for ${RECOUP_ORG_ID}:`,
          snapshotResult.error,
        );
      }
    }
  } catch (error) {
    console.error("[coding-agent] post-merge cleanup failed:", error);
  }
}
