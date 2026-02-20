import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

/**
 * Fetches raw file content from a GitHub repository.
 *
 * @param githubRepo - The parameters object
 * @param githubRepo.githubRepo - The full GitHub repository URL (e.g. "https://github.com/owner/repo")
 * @param githubRepo.path - The file path within the repository
 * @returns The file content string or an error
 */
export async function getRawFileContent({
  githubRepo,
  path,
}: {
  githubRepo: string;
  path: string;
}): Promise<{ content: string } | { error: string }> {
  const repoInfo = parseGitHubRepoUrl(githubRepo);
  if (!repoInfo) {
    return { error: "Invalid GitHub repository URL" };
  }

  const { owner, repo } = repoInfo;
  const token = process.env.GITHUB_TOKEN;
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;

  const response = await fetch(url, {
    ...(token && {
      headers: { Authorization: `Bearer ${token}` },
    }),
  });
  if (!response.ok) {
    if (response.status === 404) {
      return { error: "File not found in repository" };
    }
    return { error: `Failed to fetch file: ${response.statusText}` };
  }

  const content = await response.text();
  return { content };
}
