import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

export interface FileTreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

/**
 * Fetches the full recursive file tree for a GitHub repository.
 *
 * @param githubRepoUrl - A GitHub repository URL
 * @returns Array of file tree entries, or null on failure
 */
export async function getRepoFileTree(
  githubRepoUrl: string,
): Promise<FileTreeEntry[] | null> {
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

    return treeData.tree.map(entry => ({
      path: entry.path,
      type: entry.type as "blob" | "tree",
      sha: entry.sha,
      ...(entry.size !== undefined && { size: entry.size }),
    }));
  } catch (error) {
    console.error("Error fetching GitHub file tree:", error);
    return null;
  }
}
