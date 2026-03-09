import { deleteCodingAgentPRState } from "./prState";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { RECOUP_ORG_ID } from "@/lib/const";
import type { CodingAgentThreadState } from "./types";

const SNAPSHOT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/**
 * Handles post-merge cleanup after all PRs merged successfully.
 * Deletes the shared PR state keys for all repos and persists the latest
 * snapshot via upsertAccountSnapshot.
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
