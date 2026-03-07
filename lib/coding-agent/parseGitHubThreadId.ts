/**
 * Parses a GitHub-formatted thread ID (github:{owner/repo}:{prNumber}).
 * Returns null if the thread ID is not a GitHub thread.
 */
export function parseGitHubThreadId(
  threadId: string,
): { repo: string; prNumber: number } | null {
  if (!threadId.startsWith("github:")) return null;

  const parts = threadId.split(":");
  if (parts.length !== 3) return null;

  const repo = parts[1];
  const prNumber = parseInt(parts[2], 10);

  if (!repo.includes("/") || isNaN(prNumber)) return null;

  return { repo, prNumber };
}
