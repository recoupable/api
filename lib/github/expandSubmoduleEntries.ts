import { getRepoGitModules } from "./getRepoGitModules";
import { getRepoFileTree, type FileTreeEntry } from "./getRepoFileTree";

interface SubmoduleRef {
  path: string;
  sha: string;
}

/**
 * Expand Submodule Entries.
 *
 * @param root0 - Input object.
 * @param root0.regularEntries - Value for root0.regularEntries.
 * @param root0.submoduleEntries - Value for root0.submoduleEntries.
 * @param root0.repo - Value for root0.repo.
 * @param root0.repo.owner - Value for root0.repo.owner.
 * @param root0.repo.repo - Value for root0.repo.repo.
 * @param root0.repo.branch - Value for root0.repo.branch.
 * @returns - Computed result.
 */
export async function expandSubmoduleEntries({
  regularEntries,
  submoduleEntries,
  repo,
}: {
  regularEntries: FileTreeEntry[];
  submoduleEntries: SubmoduleRef[];
  repo: { owner: string; repo: string; branch: string };
}): Promise<FileTreeEntry[]> {
  const submodules = await getRepoGitModules(repo);

  if (!submodules) {
    for (const sub of submoduleEntries) {
      regularEntries.push({ path: sub.path, type: "tree", sha: sub.sha });
    }
    return regularEntries;
  }

  const submoduleUrlMap = new Map(submodules.map(s => [s.path, s.url]));

  const submoduleResults = await Promise.all(
    submoduleEntries.map(async sub => {
      const url = submoduleUrlMap.get(sub.path);
      if (!url) return { path: sub.path, sha: sub.sha, entries: null };

      const entries = await getRepoFileTree(url);
      return { path: sub.path, sha: sub.sha, entries };
    }),
  );

  for (const { path, sha, entries } of submoduleResults) {
    regularEntries.push({ path, type: "tree", sha });
    if (entries) {
      for (const entry of entries) {
        regularEntries.push({ ...entry, path: `${path}/${entry.path}` });
      }
    }
  }

  return regularEntries;
}
