import type { Sandbox } from "@vercel/sandbox";

/**
 * Clones the account's GitHub repo into the sandbox working directory.
 * Skips if no repo URL is provided.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param githubRepo - The GitHub repo URL to clone (e.g. "https://github.com/owner/repo")
 * @throws Error if the git clone command fails
 */
export async function cloneGithubRepoInSandbox(
  sandbox: Sandbox,
  githubRepo: string | null | undefined,
): Promise<void> {
  if (!githubRepo) {
    return;
  }

  const result = await sandbox.runCommand({
    cmd: "git",
    args: ["clone", githubRepo, "."],
    cwd: "/home/user",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone GitHub repo: ${githubRepo}`);
  }
}
