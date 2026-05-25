import type { AutoCommitResult } from "@/lib/chat/auto-commit/performAutoCommit";

/**
 * Data shape carried by the `data-commit` UI chunk emitted from
 * `runAgentWorkflow` after auto-commit runs. Mirrors open-agents'
 * `WebAgentCommitData` byte-for-byte so the shared chat UI can render
 * it without conditional logic on the source surface.
 */
export interface CommitData {
  /**
   * `"pending"` is set when the workflow emits the initial chunk
   * before the commit step runs (so the UI can show a spinner).
   * `buildCommitData` itself only ever produces the terminal three
   * statuses; pending is constructed inline in `runAgentWorkflow`.
   */
  status: "pending" | "success" | "error" | "skipped";
  committed: boolean;
  pushed: boolean;
  commitMessage?: string;
  commitSha?: string;
  /**
   * GitHub commit URL. Set only when the commit was both committed
   * AND pushed AND has a SHA — i.e., the link will actually resolve
   * on GitHub.
   */
  url?: string;
  error?: string;
}

function buildGitHubCommitUrl(repoOwner: string, repoName: string, commitSha: string): string {
  return `https://github.com/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/commit/${encodeURIComponent(commitSha)}`;
}

/**
 * Shapes an `AutoCommitResult` into the UI chunk payload.
 *
 * Resolution order:
 *   - `result.error` set → `status: "error"` (preserves any commit/push
 *     metadata that landed so the UI can still link to the partial
 *     result)
 *   - `result.committed` → `status: "success"`
 *   - otherwise → `status: "skipped"`
 *
 * Mirrors open-agents' `apps/web/app/workflows/chat.ts:buildCommitData`.
 */
export function buildCommitData(
  result: AutoCommitResult,
  repoOwner: string,
  repoName: string,
): CommitData {
  if (result.error) {
    return {
      status: "error",
      committed: result.committed,
      pushed: result.pushed,
      commitMessage: result.commitMessage,
      commitSha: result.commitSha,
      url:
        result.pushed && result.commitSha
          ? buildGitHubCommitUrl(repoOwner, repoName, result.commitSha)
          : undefined,
      error: result.error,
    };
  }

  if (result.committed) {
    return {
      status: "success",
      committed: result.committed,
      pushed: result.pushed,
      commitMessage: result.commitMessage,
      commitSha: result.commitSha,
      url:
        result.pushed && result.commitSha
          ? buildGitHubCommitUrl(repoOwner, repoName, result.commitSha)
          : undefined,
    };
  }

  return {
    status: "skipped",
    committed: false,
    pushed: false,
  };
}
