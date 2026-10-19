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

  // Guarded writes must use the reader condition unchanged; only legacy writes fetch a SHA.
  let existingSha: string | undefined = expectedSha;
  if (expectedSha === undefined) {
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
      return {
        error: `Network error checking existing file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const body: Record<string, string> = {
    message,
    content: content.toString("base64"),
  };

  if (existingSha) {
    body.sha = existingSha;
  }
  if (expectedSha !== undefined) body.branch = "main";

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
      if (expectedSha !== undefined && response.status === 409) {
        return {
          error: "File changed. Read the current revision before saving again.",
          conflict: true,
        };
      }
      if (expectedSha !== undefined) return { error: "Could not save versioned file" };
      const errorText = await response.text();
      return { error: `Failed to upload file: ${response.status} ${errorText}` };
    }

    const result = await response.json();
    return {
      path: result.content.path,
      sha: result.content.sha,
    };
  } catch (err) {
    if (expectedSha !== undefined) return { error: "Could not save versioned file" };
    return {
      error: `Network error uploading file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
