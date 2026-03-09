import { deleteCodingAgentPRState } from "./prState";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { RECOUP_ORG_ID } from "@/lib/const";
import type { CodingAgentThreadState } from "./types";

/**
 * Handles post-merge cleanup after all PRs merged successfully.
 * Deletes the shared PR state key and persists the latest snapshot.
 */
export async function handleMergeSuccess(state: CodingAgentThreadState): Promise<void> {
  if (state.branch && state.prs?.[0]?.repo) {
    await deleteCodingAgentPRState(state.prs[0].repo, state.branch);
  }

  if (state.snapshotId) {
    const snapshotResult = await upsertAccountSnapshot({
      account_id: RECOUP_ORG_ID,
      snapshot_id: state.snapshotId,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (snapshotResult.error) {
      console.error(
        `[coding-agent] failed to persist snapshot for ${RECOUP_ORG_ID}:`,
        snapshotResult.error,
      );
    }
  }
}
