import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";
import { expandSubmoduleEntries } from "./expandSubmoduleEntries";

export interface FileTreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

/**
 * Fetches the full recursive file tree for a GitHub repository.
 * Expands git submodules so their contents appear as directories in the tree.
 *
 * @param githubRepoUrl - A GitHub repository URL
 * @returns Array of file tree entries, or null on failure
 */
export async function getRepoFileTree(githubRepoUrl: string): Promise<FileTreeEntry[] | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set");
    return null;
  }

  const repoInfo = parseGitHubRepoUrl(githubRepoUrl);
  if (!repoInfo) {
    console.error(`Failed to parse GitHub repo URL: ${githubRepoUrl}`);
    return null;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Recoup-API",
  };

  try {
    const repoResponse = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`,
      { headers },
    );
    if (!repoResponse.ok) {
      console.error(`GitHub API error fetching repo: ${repoResponse.status}`);
      return null;
    }
    const repoData = (await repoResponse.json()) as { default_branch: string };
    const defaultBranch = repoData.default_branch;

    const treeResponse = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers },
    );
    if (!treeResponse.ok) {
      console.error(`GitHub API error fetching tree: ${treeResponse.status}`);
      return null;
    }
    const treeData = (await treeResponse.json()) as {
      tree: Array<{ path: string; type: string; sha: string; size?: number }>;
    };

    const regularEntries: FileTreeEntry[] = [];
    const submoduleEntries: Array<{ path: string; sha: string }> = [];

    for (const entry of treeData.tree) {
      if (entry.type === "commit") {
        submoduleEntries.push({ path: entry.path, sha: entry.sha });
      } else {
        regularEntries.push({
          path: entry.path,
          type: entry.type as "blob" | "tree",
          sha: entry.sha,
          ...(entry.size !== undefined && { size: entry.size }),
        });
      }
    }

    if (submoduleEntries.length === 0) {
      return regularEntries;
    }

    return expandSubmoduleEntries({
      regularEntries,
      submoduleEntries,
      repo: { owner: repoInfo.owner, repo: repoInfo.repo, branch: defaultBranch },
    });
  } catch (error) {
    console.error("Error fetching GitHub file tree:", error);
    return null;
  }
}
