import type { CreateFileResult } from "./createOrUpdateFileContent";

/** Commit once, retaining an observed SHA unchanged at GitHub's atomic boundary. */
export async function commitFileContent({
  url,
  token,
  message,
  content,
  sha,
  guarded,
}: {
  url: string;
  token: string;
  message: string;
  content: Buffer;
  sha?: string;
  guarded: boolean;
}): Promise<CreateFileResult | { error: string; conflict?: boolean }> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: content.toString("base64"),
        ...(sha && { sha }),
        ...(guarded && { branch: "main" }),
      }),
    });
    if (!response.ok) {
      if (guarded && response.status === 409)
        return {
          error: "File changed. Read the current revision before saving again.",
          conflict: true,
        };
      console.error("[GitHub] File commit failed:", response.status, await response.text());
      return { error: guarded ? "Could not save versioned file" : "Failed to upload file" };
    }
    const result = await response.json();
    return { path: result.content.path, sha: result.content.sha };
  } catch (error) {
    console.error("[GitHub] File commit failed:", error);
    return { error: guarded ? "Could not save versioned file" : "Failed to upload file" };
  }
}
