import type { Sandbox } from "@/lib/sandbox/abstraction";
import generateText from "@/lib/ai/generateText";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

export interface AutoCommitParams {
  sandbox: Sandbox;
  sessionId: string;
  sessionTitle: string;
  repoOwner: string;
  repoName: string;
}

export interface AutoCommitResult {
  committed: boolean;
  pushed: boolean;
  commitMessage?: string;
  commitSha?: string;
  error?: string;
}

const FALLBACK_COMMIT_MESSAGE = "chore: update repository changes";
const COMMIT_MESSAGE_MAX_LENGTH = 72;

const TIMEOUT_QUICK_MS = 10_000;
const TIMEOUT_DIFF_MS = 30_000;
const TIMEOUT_PUSH_MS = 60_000;
const TIMEOUT_RESOLVE_MS = 5_000;

/**
 * Stages all changes in the sandbox, generates a commit message via
 * the gateway, commits, and pushes. Ports
 * `open-agents/apps/web/lib/chat/auto-commit-direct.ts:performAutoCommit`.
 *
 * Failure modes are deliberately granular so the caller can surface
 * the right UI state:
 *   - `{ committed: false, pushed: false }` when nothing to commit
 *     (git status empty, or git status itself failed)
 *   - `{ committed: false, pushed: false, error }` when stage/commit
 *     fails
 *   - `{ committed: true, pushed: false, error }` when the commit
 *     landed locally but the push failed (caller should retry or
 *     surface the local sha so the user knows the changes aren't
 *     remote yet)
 *
 * Auth: if `GITHUB_TOKEN` is set (the service-account token used to
 * clone), the function rewrites `origin` to an x-access-token URL so
 * the subsequent push authenticates. When the token is absent the
 * remote URL is left alone (public repos / pre-authed remotes still
 * work).
 */
export async function performAutoCommit(params: AutoCommitParams): Promise<AutoCommitResult> {
  const { sandbox, sessionTitle, repoOwner, repoName } = params;
  const cwd = sandbox.workingDirectory;

  // 1. Check for uncommitted changes
  const statusResult = await sandbox.exec("git status --porcelain", cwd, TIMEOUT_QUICK_MS);
  if (!statusResult.success || !statusResult.stdout.trim()) {
    return { committed: false, pushed: false };
  }

  // 2. Configure auth on origin so the push can authenticate.
  const token = getServiceGithubToken();
  if (token) {
    const authUrl = `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`;
    await sandbox.exec(`git remote set-url origin "${authUrl}"`, cwd, TIMEOUT_QUICK_MS);
  }

  // 3. Stage all changes
  const addResult = await sandbox.exec("git add -A", cwd, TIMEOUT_QUICK_MS);
  if (!addResult.success) {
    return {
      committed: false,
      pushed: false,
      error: "Failed to stage changes",
    };
  }

  // 4. Generate commit message (LLM-generated from staged diff, with
  //    a sane fallback when the gateway fails or the diff is empty).
  const commitMessage = await generateCommitMessage(sandbox, cwd, sessionTitle);

  // 5. Commit. Single-quote escaping mirrors open-agents'
  //    auto-commit-direct so messages containing apostrophes don't
  //    break the shell.
  const escapedMessage = commitMessage.replace(/'/g, "'\\''");
  const commitResult = await sandbox.exec(
    `git commit -m '${escapedMessage}'`,
    cwd,
    TIMEOUT_QUICK_MS,
  );
  if (!commitResult.success) {
    return {
      committed: false,
      pushed: false,
      error: `Failed to commit: ${commitResult.stdout || commitResult.stderr}`,
    };
  }

  const headResult = await sandbox.exec("git rev-parse HEAD", cwd, TIMEOUT_RESOLVE_MS);
  const commitSha = headResult.stdout.trim() || undefined;

  // 6. Push. GIT_TERMINAL_PROMPT=0 so a missing/expired token fails
  //    fast instead of hanging on a credential prompt the workflow
  //    runtime can't answer.
  const branchResult = await sandbox.exec("git symbolic-ref --short HEAD", cwd, TIMEOUT_RESOLVE_MS);
  const currentBranch = branchResult.stdout.trim() || "HEAD";

  const pushResult = await sandbox.exec(
    `GIT_TERMINAL_PROMPT=0 git push -u origin ${currentBranch}`,
    cwd,
    TIMEOUT_PUSH_MS,
  );
  if (!pushResult.success) {
    console.warn(
      `[auto-commit] Push failed for session ${params.sessionId}: ${pushResult.stderr || pushResult.stdout}`,
    );
    return {
      committed: true,
      pushed: false,
      commitMessage,
      commitSha,
      error: "Commit succeeded but push failed",
    };
  }

  return {
    committed: true,
    pushed: true,
    commitMessage,
    commitSha,
  };
}

async function generateCommitMessage(
  sandbox: Sandbox,
  cwd: string,
  sessionTitle: string,
): Promise<string> {
  try {
    const stagedDiffResult = await sandbox.exec("git diff --cached", cwd, TIMEOUT_DIFF_MS);
    const diffForCommit = stagedDiffResult.stdout;

    if (!diffForCommit.trim()) {
      return FALLBACK_COMMIT_MESSAGE;
    }

    const result = await generateText({
      model: "anthropic/claude-haiku-4.5",
      prompt: `Generate a concise git commit message for these changes. Use conventional commit format (e.g., "feat:", "fix:", "refactor:"). One line only, max ${COMMIT_MESSAGE_MAX_LENGTH} characters.

Session context: ${sessionTitle}

Diff:
${diffForCommit.slice(0, 8000)}

Respond with ONLY the commit message, nothing else.`,
    });

    const generated = result.text.trim().split("\n")[0]?.trim();
    if (generated && generated.length > 0) {
      return generated.slice(0, COMMIT_MESSAGE_MAX_LENGTH);
    }
  } catch (error) {
    console.warn("[auto-commit] Failed to generate commit message:", error);
  }

  return FALLBACK_COMMIT_MESSAGE;
}
