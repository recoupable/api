import type { GitHubThreadId } from "@chat-adapter/github";

/**
 * Encodes a GitHubThreadId into the Chat SDK thread ID string format.
 * Mirrors GitHubAdapter.encodeThreadId without needing an adapter instance.
 *
 * - PR-level: `github:{owner}/{repo}:{prNumber}`
 * - Review comment: `github:{owner}/{repo}:{prNumber}:rc:{reviewCommentId}`
 *
 * @param thread
 */
export function encodeGitHubThreadId(thread: GitHubThreadId): string {
  const { owner, repo, prNumber, reviewCommentId } = thread;
  if (reviewCommentId) {
    return `github:${owner}/${repo}:${prNumber}:rc:${reviewCommentId}`;
  }
  return `github:${owner}/${repo}:${prNumber}`;
}
