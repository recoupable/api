import { connectSandbox, type SandboxState } from "@/lib/sandbox/factory";

const STATUS_TIMEOUT_MS = 10_000;

/**
 * Quick pre-flight: does the sandbox have anything staged-or-unstaged
 * that auto-commit should pick up? Returns true when `git status
 * --porcelain` reports any output.
 *
 * Failure mode: fail-open. If the sandbox connect or the git command
 * itself fails, return `true` and let `runAutoCommit` try anyway —
 * it will surface the real error in its own `AutoCommitResult`. The
 * alternative (returning false on error) would silently skip
 * auto-commit on a transient sandbox blip, which we don't want.
 *
 * Mirrors open-agents'
 * `apps/web/app/workflows/chat-post-finish.ts:hasAutoCommitChangesStep`.
 */
export async function hasAutoCommitChanges(params: {
  sandboxState: SandboxState;
}): Promise<boolean> {
  "use step";
  console.log("[hasAutoCommitChanges] enter");
  try {
    const sandbox = await connectSandbox(params.sandboxState);
    const statusResult = await sandbox.exec(
      "git status --porcelain",
      sandbox.workingDirectory,
      STATUS_TIMEOUT_MS,
    );

    if (!statusResult.success) {
      console.warn(
        "[hasAutoCommitChanges] git status failed; assuming changes present (fail-open)",
        { stderr: statusResult.stderr },
      );
      return true;
    }

    const hasChanges = statusResult.stdout.trim().length > 0;
    console.log("[hasAutoCommitChanges] done", { hasChanges });
    return hasChanges;
  } catch (error) {
    console.error("[hasAutoCommitChanges] unexpected error (failing open):", error);
    return true;
  }
}
