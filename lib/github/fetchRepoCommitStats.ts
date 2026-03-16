import { parseLinkHeaderLastPage } from "./parseLinkHeaderLastPage";

interface GitHubCommit {
  commit: {
    message: string;
    author: {
      date: string;
    } | null;
    committer: {
      date: string;
    } | null;
  };
}

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
  const latestResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Recoup-API",
      },
    },
  );

  if (!latestResponse.ok) return null;

  const latestCommits = (await latestResponse.json()) as GitHubCommit[];
  if (latestCommits.length === 0) return null;

  const countResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Recoup-API",
      },
    },
  );

  if (!countResponse.ok) return null;

  const linkHeader = countResponse.headers.get("Link");
  const totalCommits = parseLinkHeaderLastPage(linkHeader);

  let earliestCommittedAt = latestCommits[latestCommits.length - 1].commit.author?.date ?? "";

  if (totalCommits > 5) {
    const earliestResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&page=${totalCommits}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Recoup-API",
        },
      },
    );

    if (earliestResponse.ok) {
      const earliestCommits = (await earliestResponse.json()) as GitHubCommit[];
      if (earliestCommits.length > 0) {
        earliestCommittedAt = earliestCommits[0].commit.author?.date ?? earliestCommittedAt;
      }
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
