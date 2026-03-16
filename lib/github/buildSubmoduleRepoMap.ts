import type { AccountSnapshotOwner } from "@/lib/supabase/account_snapshots/selectAllAccountSnapshotsWithOwners";
import { getOrgRepoUrls } from "./getOrgRepoUrls";

export interface AccountRepoEntry {
  account_id: string;
  repo_url: string;
}

/**
 * Builds a map of org repo URL -> list of account repo entries that include it as a submodule.
 *
 * @param accountSnapshots - Array of { account_id, github_repo } objects
 * @returns Map of normalized repo URL to array of AccountRepoEntry objects
 */
export async function buildSubmoduleRepoMap(
  accountSnapshots: AccountSnapshotOwner[],
): Promise<Map<string, AccountRepoEntry[]>> {
  const repoMap = new Map<string, AccountRepoEntry[]>();

  await Promise.all(
    accountSnapshots.map(async ({ account_id, github_repo: repoUrl }) => {
      try {
        const submoduleUrls = await getOrgRepoUrls(repoUrl);
        for (const url of submoduleUrls) {
          const normalized = url.replace(/\.git$/, "");
          const existing = repoMap.get(normalized) ?? [];
          existing.push({ account_id, repo_url: repoUrl });
          repoMap.set(normalized, existing);
        }
      } catch {
        // skip repos that fail
      }
    }),
  );

  return repoMap;
}
