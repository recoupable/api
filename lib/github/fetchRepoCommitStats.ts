import { fetchLatestCommits } from "./fetchLatestCommits";
import { fetchRepoCommitCount } from "./fetchRepoCommitCount";
import { fetchEarliestCommit } from "./fetchEarliestCommit";

export interface RepoCommitStats {
  total_commits: number;
  latest_commit_messages: string[];
  earliest_committed_at: string;
  latest_committed_at: string;
}

/**
 * Fetches commit stats for a single repo:
 * - total commit count (via Link header pagination trick)
 * - latest 5 commit messages
 * - earliest committed_at
 * - latest committed_at
 *
 * @param owner - GitHub org/user name
 * @param repo - Repository name
 * @param token - GitHub API token
 * @returns Commit stats or null if the repo has no commits or API fails
 */
export async function fetchRepoCommitStats(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoCommitStats | null> {
  const latestCommits = await fetchLatestCommits(owner, repo, token, 5);
  if (!latestCommits || latestCommits.length === 0) return null;

  const totalCommits = await fetchRepoCommitCount(owner, repo, token);
  if (totalCommits === null) return null;

  let earliestCommittedAt = latestCommits[latestCommits.length - 1].commit.author?.date ?? "";

  if (totalCommits > 5) {
    const earliest = await fetchEarliestCommit(owner, repo, token, totalCommits);
    if (earliest) {
      earliestCommittedAt = earliest.commit.author?.date ?? earliestCommittedAt;
    }
  }

  const latestCommittedAt = latestCommits[0].commit.author?.date ?? "";
  const latestCommitMessages = latestCommits.map((c) => c.commit.message.split("\n")[0]);

  return {
    total_commits: totalCommits,
    latest_commit_messages: latestCommitMessages,
    earliest_committed_at: earliestCommittedAt,
    latest_committed_at: latestCommittedAt,
  };
}
