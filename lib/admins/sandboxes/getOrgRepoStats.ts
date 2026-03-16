import type { AccountSnapshotOwner } from "@/lib/supabase/account_snapshots/selectAllAccountSnapshotsWithOwners";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { listOrgRepos } from "@/lib/github/listOrgRepos";
import { fetchRepoCommitStats } from "@/lib/github/fetchRepoCommitStats";
import { buildSubmoduleRepoMap } from "@/lib/github/buildSubmoduleRepoMap";

export interface AccountRepo {
  account_id: string;
  email: string | null;
  repo_url: string;
}

export interface OrgRepoRow {
  repo_name: string;
  repo_url: string;
  total_commits: number;
  latest_commit_messages: string[];
  earliest_committed_at: string;
  latest_committed_at: string;
  account_repos: AccountRepo[];
}

/**
 * Fetches commit statistics for all repositories in the recoupable GitHub org,
 * enriched with account email addresses.
 *
 * @param accountSnapshots - Array of { account_id, github_repo } objects for submodule analysis
 * @returns Array of OrgRepoRow sorted by total_commits descending
 */
export async function getOrgRepoStats(
  accountSnapshots: AccountSnapshotOwner[],
): Promise<OrgRepoRow[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set");
    return [];
  }

  // Build email map for all account IDs
  const accountIds = [...new Set(accountSnapshots.map(s => s.account_id))];
  const emailRows = accountIds.length > 0
    ? await selectAccountEmails({ accountIds })
    : [];
  const emailMap = new Map<string, string | null>(
    emailRows
      .filter(r => r.account_id !== null)
      .map(r => [r.account_id as string, r.email]),
  );

  const [repos, submoduleRepoMap] = await Promise.all([
    listOrgRepos(token),
    buildSubmoduleRepoMap(accountSnapshots),
  ]);

  const statsResults = await Promise.allSettled(
    repos.map(async (repo): Promise<OrgRepoRow | null> => {
      const stats = await fetchRepoCommitStats("recoupable", repo.name, token);
      if (!stats) return null;

      const normalizedUrl = repo.html_url.replace(/\.git$/, "");
      const repoEntries = submoduleRepoMap.get(normalizedUrl) ?? [];

      const accountRepos: AccountRepo[] = repoEntries.map(({ account_id, repo_url }) => ({
        account_id,
        email: emailMap.get(account_id) ?? null,
        repo_url,
      }));

      return {
        repo_name: repo.name,
        repo_url: repo.html_url,
        total_commits: stats.total_commits,
        latest_commit_messages: stats.latest_commit_messages,
        earliest_committed_at: stats.earliest_committed_at,
        latest_committed_at: stats.latest_committed_at,
        account_repos: accountRepos,
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
