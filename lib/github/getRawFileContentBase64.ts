import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

/**
 * Fetches raw file content from a GitHub repository and returns it as base64.
 * Unlike getRawFileContent, this preserves binary data by avoiding UTF-8 text decoding.
 *
 * @param params - The parameters object
 * @param params.githubRepo - The full GitHub repository URL (e.g. "https://github.com/owner/repo")
 * @param params.path - The file path within the repository
 * @returns The base64-encoded file content or an error
 */
export async function getRawFileContentBase64({
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

  const buffer = Buffer.from(await response.arrayBuffer());
  return { content: buffer.toString("base64") };
}
