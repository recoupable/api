import type { GitHubThreadId } from "@chat-adapter/github";

/**
 * Encode Git Hub Thread Id.
 *
 * @param thread - Parameter.
 * @returns - Result.
 */
export function encodeGitHubThreadId(thread: GitHubThreadId): string {
  const { owner, repo, prNumber, reviewCommentId } = thread;
  if (reviewCommentId) {
    return `github:${owner}/${repo}:${prNumber}:rc:${reviewCommentId}`;
  }
  return `github:${owner}/${repo}:${prNumber}`;
}
