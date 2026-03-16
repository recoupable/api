import { getOrgRepoUrls } from "@/lib/github/getOrgRepoUrls";

export interface OrgRepoRow {
  repo_name: string;
  repo_url: string;
  total_commits: number;
  latest_commit_messages: string[];
  earliest_committed_at: string;
  latest_committed_at: string;
  account_repo_count: number;
}

interface GitHubRepo {
  name: string;
  html_url: string;
}

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

/**
 * Parses the GitHub API Link header to extract the last page number.
 * Returns 1 if no Link header or no "last" relation found.
 */
function parseLinkHeaderLastPage(linkHeader: string | null): number {
  if (!linkHeader) return 1;
  const match = linkHeader.match(/[?&]page=(\d+)>; rel="last"/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Fetches all repositories in the recoupable GitHub org.
 */
async function listOrgRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.github.com/orgs/recoupable/repos?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Recoup-API",
        },
      },
    );

    if (!response.ok) break;

    const batch = (await response.json()) as GitHubRepo[];
    repos.push(...batch);

    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * Fetches commit stats for a single repo:
 * - total commit count (via Link header pagination trick)
 * - latest 5 commit messages
 * - earliest committed_at
 * - latest committed_at
 */
async function fetchRepoCommitStats(
  owner: string,
  repo: string,
  token: string,
): Promise<{
  total_commits: number;
  latest_commit_messages: string[];
  earliest_committed_at: string;
  latest_committed_at: string;
} | null> {
  // Fetch latest 5 commits + get total from Link header
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

  // Get total commit count using per_page=1 Link header trick
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

  // Get earliest commit (last page with per_page=1)
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

/**
 * Builds a map of org repo URL -> count of account repos that have it as a submodule.
 */
async function buildSubmoduleCountMap(
  accountGithubRepos: string[],
): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();

  await Promise.all(
    accountGithubRepos.map(async (repoUrl) => {
      try {
        const submoduleUrls = await getOrgRepoUrls(repoUrl);
        for (const url of submoduleUrls) {
          const normalized = url.replace(/\.git$/, "");
          countMap.set(normalized, (countMap.get(normalized) ?? 0) + 1);
        }
      } catch {
        // skip repos that fail
      }
    }),
  );

  return countMap;
}

/**
 * Fetches commit statistics for all repositories in the recoupable GitHub org.
 *
 * @param accountGithubRepos - Array of account github_repo URLs to check for submodule usage
 * @returns Array of OrgRepoRow sorted by total_commits descending
 */
export async function getOrgRepoStats(
  accountGithubRepos: string[],
): Promise<OrgRepoRow[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set");
    return [];
  }

  const [repos, submoduleCountMap] = await Promise.all([
    listOrgRepos(token),
    buildSubmoduleCountMap(accountGithubRepos),
  ]);

  const statsResults = await Promise.allSettled(
    repos.map(async (repo): Promise<OrgRepoRow | null> => {
      const stats = await fetchRepoCommitStats("recoupable", repo.name, token);
      if (!stats) return null;

      // Normalize URL for lookup
      const normalizedUrl = repo.html_url.replace(/\.git$/, "");

      return {
        repo_name: repo.name,
        repo_url: repo.html_url,
        total_commits: stats.total_commits,
        latest_commit_messages: stats.latest_commit_messages,
        earliest_committed_at: stats.earliest_committed_at,
        latest_committed_at: stats.latest_committed_at,
        account_repo_count: submoduleCountMap.get(normalizedUrl) ?? 0,
      };
    }),
  );

  const rows = statsResults
    .filter(
      (r): r is PromiseFulfilledResult<OrgRepoRow> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);

  return rows.sort((a, b) => b.total_commits - a.total_commits);
}
