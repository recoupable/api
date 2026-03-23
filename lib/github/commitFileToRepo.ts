import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

export interface CommitFileResult {
  path: string;
  success: boolean;
  error?: string;
}

/**
 * Commits a single file to a GitHub repository using the Contents API.
 * Creates the file if it doesn't exist, or updates it if it does.
 *
 * @param params - The parameters object
 * @param params.githubRepo - The full GitHub repository URL (e.g. "https://github.com/owner/repo")
 * @param params.path - The file path within the repository (e.g. "src/index.ts")
 * @param params.content - The file content as a Buffer or string
 * @param params.message - The commit message
 * @returns The result indicating success or failure
 */
export async function commitFileToRepo({
  githubRepo,
  path,
  content,
  message,
}: {
  githubRepo: string;
  path: string;
  content: Buffer | string;
  message: string;
}): Promise<CommitFileResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { path, success: false, error: "GITHUB_TOKEN is not configured" };
  }

  const repoInfo = parseGitHubRepoUrl(githubRepo);
  if (!repoInfo) {
    return { path, success: false, error: "Invalid GitHub repository URL" };
  }

  const { owner, repo } = repoInfo;
  const base64Content =
    typeof content === "string"
      ? Buffer.from(content).toString("base64")
      : content.toString("base64");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Recoup-API",
    "Content-Type": "application/json",
  };

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // Check if file already exists to get its SHA (required for updates)
  let existingSha: string | undefined;
  const existingResponse = await fetch(apiUrl, { headers });
  if (existingResponse.ok) {
    const existingData = (await existingResponse.json()) as { sha?: string };
    existingSha = existingData.sha;
  }

  const body: Record<string, string> = {
    message,
    content: base64Content,
    branch: "main",
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      path,
      success: false,
      error: errorData.message ?? `GitHub API error: ${response.status}`,
    };
  }

  return { path, success: true };
}
