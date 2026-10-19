import { isUtf8 } from "node:buffer";
import { isRelativeRepoFilePath } from "./isRelativeRepoFilePath";
import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

/** Read content and its update condition from one GitHub response on main. */
export async function getVersionedFileContent({
  githubRepo,
  path,
  format,
}: {
  githubRepo: string;
  path: string;
  format?: "base64";
}): Promise<{ content: string; sha: string; encoding?: "base64" } | { error: string }> {
  if (!isRelativeRepoFilePath(path)) return { error: "Invalid repository file path" };
  const repo = parseGitHubRepoUrl(githubRepo);
  if (!repo) return { error: "Invalid GitHub repository URL" };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { error: "GitHub token not configured" };
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${encoded}?ref=main`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    },
  );
  if (!response.ok) return { error: "Could not read versioned file" };
  const file = await response.json();
  if (
    file?.type !== "file" ||
    file.target ||
    file.encoding !== "base64" ||
    typeof file.content !== "string" ||
    typeof file.sha !== "string" ||
    !/^[a-f0-9]{40}$/.test(file.sha)
  ) {
    return { error: "Versioned reads require a regular file with inline base64 content" };
  }
  const buffer = Buffer.from(file.content, "base64");
  if (format !== "base64" && !isUtf8(buffer))
    return { error: "File is not valid UTF-8; versioned text editing is unavailable" };
  return {
    content: buffer.toString(format === "base64" ? "base64" : "utf-8"),
    sha: file.sha,
    ...(format === "base64" && { encoding: "base64" as const }),
  };
}
