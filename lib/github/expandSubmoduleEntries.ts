import { getRepoGitModules } from "./getRepoGitModules";
import { getRepoFileTree, type FileTreeEntry } from "./getRepoFileTree";

interface SubmoduleRef {
  path: string;
  sha: string;
}

/**
 * Expands git submodule references into full directory trees.
 * Resolves submodule URLs from .gitmodules, fetches each submodule's tree,
 * and merges the results into the regular entries with correct path prefixes.
 *
 * @param root0 - Options object.
 * @param root0.regularEntries - Non-submodule file tree entries.
 * @param root0.submoduleEntries - Submodule references (type "commit" from GitHub Trees API).
 * @param root0.repo - Repository context for fetching .gitmodules.
 * @param root0.repo.owner - The GitHub repository owner.
 * @param root0.repo.repo - The GitHub repository name.
 * @param root0.repo.branch - The branch to read .gitmodules from.
 * @returns Combined file tree entries with submodules expanded as directories.
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
