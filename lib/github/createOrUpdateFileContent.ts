import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";
import { isRelativeRepoFilePath } from "./isRelativeRepoFilePath";
import { getExistingFileSha } from "./getExistingFileSha";
import { commitFileContent } from "./commitFileContent";

export interface CreateFileResult {
  path: string;
  sha: string;
}

/**
 * Creates or updates a file in a GitHub repository using the Contents API.
 *
 * @param params - The parameters for file creation
 * @param params.githubRepo - The full GitHub repository URL
 * @param params.path - The file path within the repository
 * @param params.content - The file content as a Buffer
 * @param params.message - The commit message
 * @param params.expectedSha - Optional reader-observed blob SHA; guards updates on main
 * @returns The created file path and SHA, or an error
 */
export async function createOrUpdateFileContent({
  githubRepo,
  path,
  content,
  message,
  expectedSha,
}: {
  githubRepo: string;
  path: string;
  content: Buffer;
  message: string;
  expectedSha?: string;
}): Promise<CreateFileResult | { error: string; conflict?: boolean }> {
  if (expectedSha !== undefined && !/^[a-f0-9]{40}$/.test(expectedSha)) {
    return { error: "expectedSha must be a Git blob SHA" };
  }
  if (!isRelativeRepoFilePath(path)) return { error: "Invalid repository file path" };
  const repoInfo = parseGitHubRepoUrl(githubRepo);
  if (!repoInfo) {
    return { error: "Invalid GitHub repository URL" };
  }

  const { owner, repo } = repoInfo;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return { error: "GitHub token not configured" };
  }

  const encodedPath = path
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  // Only legacy writes look up a new SHA; guarded writes keep the reader condition.
  let sha = expectedSha;
  if (expectedSha === undefined) {
    const existing = await getExistingFileSha(url, token);
    if ("error" in existing) return existing;
    sha = existing.sha;
  }
  return commitFileContent({
    url,
    token,
    message,
    content,
    sha,
    guarded: expectedSha !== undefined,
  });
}
