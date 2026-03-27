import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

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
 * @returns The created file path and SHA, or an error
 */
export async function createOrUpdateFileContent({
  githubRepo,
  path,
  content,
  message,
}: {
  githubRepo: string;
  path: string;
  content: Buffer;
  message: string;
}): Promise<CreateFileResult | { error: string }> {
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
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  // Check if file already exists to get its SHA for updates
  let existingSha: string | undefined;
  try {
    const getResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (getResponse.ok) {
      const existing = await getResponse.json();
      existingSha = existing.sha;
    } else if (getResponse.status !== 404) {
      const errorText = await getResponse.text();
      return { error: `Failed to check existing file: ${getResponse.status} ${errorText}` };
    }
  } catch (err) {
    return { error: `Network error checking existing file: ${err instanceof Error ? err.message : String(err)}` };
  }

  const body: Record<string, string> = {
    message,
    content: content.toString("base64"),
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Failed to upload file: ${response.status} ${errorText}` };
    }

    const result = await response.json();
    return {
      path: result.content.path,
      sha: result.content.sha,
    };
  } catch (err) {
    return { error: `Network error uploading file: ${err instanceof Error ? err.message : String(err)}` };
  }
}
