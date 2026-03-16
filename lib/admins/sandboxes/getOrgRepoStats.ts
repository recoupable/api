import { listOrgRepos } from "@/lib/github/listOrgRepos";
import { fetchRepoCommitStats } from "@/lib/github/fetchRepoCommitStats";
import { buildSubmoduleRepoMap } from "@/lib/github/buildSubmoduleRepoMap";

export interface OrgRepoRow {
  repo_name: string;
  repo_url: string;
  total_commits: number;
  latest_commit_messages: string[];
  earliest_committed_at: string;
  latest_committed_at: string;
  account_repos: string[];
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

  const [repos, submoduleRepoMap] = await Promise.all([
    listOrgRepos(token),
    buildSubmoduleRepoMap(accountGithubRepos),
  ]);

  const statsResults = await Promise.allSettled(
    repos.map(async (repo): Promise<OrgRepoRow | null> => {
      const stats = await fetchRepoCommitStats("recoupable", repo.name, token);
      if (!stats) return null;

      const normalizedUrl = repo.html_url.replace(/\.git$/, "");

      return {
        repo_name: repo.name,
        repo_url: repo.html_url,
        total_commits: stats.total_commits,
        latest_commit_messages: stats.latest_commit_messages,
        earliest_committed_at: stats.earliest_committed_at,
        latest_committed_at: stats.latest_committed_at,
        account_repos: submoduleRepoMap.get(normalizedUrl) ?? [],
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
