import { connectSandbox, type SandboxState } from "@/lib/sandbox/factory";
import { performAutoCommit, type AutoCommitResult } from "@/lib/chat/auto-commit/performAutoCommit";

/**
 * Workflow step that runs auto-commit + push in the sandbox. Wraps
 * `performAutoCommit` with sandbox connect + global error handling so
 * the chat workflow never aborts on a commit-time hiccup — failures
 * land in `AutoCommitResult.error`, which the caller surfaces via the
 * `data-commit` UI chunk.
 *
 * Mirrors open-agents'
 * `apps/web/app/workflows/chat-post-finish.ts:runAutoCommitStep`.
 */
export async function runAutoCommit(params: {
  sessionId: string;
  sessionTitle: string;
  repoOwner: string;
  repoName: string;
  sandboxState: SandboxState;
}): Promise<AutoCommitResult> {
  "use step";
  console.log("[runAutoCommit] enter", {
    sessionId: params.sessionId,
    repoOwner: params.repoOwner,
    repoName: params.repoName,
  });
  try {
    const sandbox = await connectSandbox(params.sandboxState);
    const result = await performAutoCommit({
      sandbox,
      sessionId: params.sessionId,
      sessionTitle: params.sessionTitle,
      repoOwner: params.repoOwner,
      repoName: params.repoName,
    });
    console.log("[runAutoCommit] done", {
      committed: result.committed,
      pushed: result.pushed,
      hasError: result.error !== undefined,
    });
    return result;
  } catch (error) {
    console.error("[runAutoCommit] unexpected error:", error);
    return {
      committed: false,
      pushed: false,
      error: error instanceof Error ? error.message : "Auto-commit failed",
    };
  }
}
