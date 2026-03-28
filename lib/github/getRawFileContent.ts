import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

/**
 * Fetches raw file content from a GitHub repository.
 *
 * When format is "base64", returns binary-safe base64-encoded content
 * with an encoding field. Otherwise returns UTF-8 text.
 *
 * @param params - The parameters object
 * @param params.githubRepo - The full GitHub repository URL (e.g. "https://github.com/owner/repo")
 * @param params.path - The file path within the repository
 * @param params.format - Optional format: "base64" for binary-safe encoding
 * @returns The file content (with optional encoding field) or an error
 */
export async function getRawFileContent({
  githubRepo,
  path,
  format,
}: {
  githubRepo: string;
  path: string;
  format?: "base64";
}): Promise<
  { content: string; encoding?: "base64" } | { error: string }
> {
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

  if (format === "base64") {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { content: buffer.toString("base64"), encoding: "base64" };
  }

  const content = await response.text();
  return { content };
}
