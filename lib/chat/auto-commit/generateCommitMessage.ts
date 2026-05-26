import type { Sandbox } from "@/lib/sandbox/abstraction";
import generateText from "@/lib/ai/generateText";

const FALLBACK_COMMIT_MESSAGE = "chore: update repository changes";
const COMMIT_MESSAGE_MAX_LENGTH = 72;
const DIFF_PROMPT_TRUNCATE_CHARS = 8000;
const TIMEOUT_DIFF_MS = 30_000;

/**
 * Asks the gateway to produce a conventional-commit-formatted
 * message describing the staged diff. Falls back to a sane default
 * when:
 *   - the staged diff is empty (rare race; the caller has already
 *     verified there's something to commit, but `git diff --cached`
 *     can race with the actual stage)
 *   - the gateway call throws
 *   - the gateway returns an empty/whitespace string
 *
 * Truncates to 72 chars to fit standard commit-message-line width.
 * Only the first line of the LLM output is used — the prompt asks
 * for a single line but models sometimes follow with body text.
 *
 * Ports the inline `generateCommitMessage` helper that previously
 * lived inside `performAutoCommit.ts`. Extracting it lets callers
 * compose alternative commit message strategies without re-running
 * the full performAutoCommit sandbox pipeline.
 */
export async function generateCommitMessage(
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
      model: "openai/gpt-5.4-nano",
      prompt: `Generate a concise git commit message for these changes. Use conventional commit format (e.g., "feat:", "fix:", "refactor:"). One line only, max ${COMMIT_MESSAGE_MAX_LENGTH} characters.

Session context: ${sessionTitle}

Diff:
${diffForCommit.slice(0, DIFF_PROMPT_TRUNCATE_CHARS)}

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
