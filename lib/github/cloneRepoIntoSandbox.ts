import type { Sandbox } from "@vercel/sandbox";

/**
 * Clones a GitHub repo into a live sandbox.
 * Skips if the repo is already cloned (.git directory exists).
 * Uses GITHUB_TOKEN for authenticated access.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param githubRepo - The GitHub repo HTML URL (e.g. https://github.com/recoupable/repo-name)
 * @returns true if the repo is cloned (or was already), false on failure
 */
export async function cloneRepoIntoSandbox(sandbox: Sandbox, githubRepo: string): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    console.error("Missing GITHUB_TOKEN environment variable");
    return false;
  }

  // Check if already cloned
  const gitCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-d", ".git"],
  });

  if (gitCheck.exitCode === 0) {
    return true;
  }

  // Build authenticated URL
  const repoUrl = githubRepo.replace(
    "https://github.com/",
    `https://x-access-token:${githubToken}@github.com/`,
  );

  // Initialize git and add remote
  const initResult = await sandbox.runCommand({ cmd: "git", args: ["init"] });
  if (initResult.exitCode !== 0) {
    console.error("Failed to initialize git");
    return false;
  }

  const remoteResult = await sandbox.runCommand({
    cmd: "git",
    args: ["remote", "add", "origin", repoUrl],
  });
  if (remoteResult.exitCode !== 0) {
    console.error("Failed to add remote");
    return false;
  }

  // Fetch from remote
  const fetchResult = await sandbox.runCommand({
    cmd: "git",
    args: ["fetch", "origin"],
  });

  if (fetchResult.exitCode === 0) {
    // Check if origin/main exists (won't for empty repos)
    const refCheck = await sandbox.runCommand({
      cmd: "git",
      args: ["rev-parse", "--verify", "origin/main"],
    });

    if (refCheck.exitCode === 0) {
      const checkoutResult = await sandbox.runCommand({
        cmd: "git",
        args: ["checkout", "-B", "main", "origin/main"],
      });
      if (checkoutResult.exitCode !== 0) {
        console.error("Failed to checkout main branch");
        return false;
      }
    }
  }

  // Configure git user
  await sandbox.runCommand({
    cmd: "git",
    args: ["config", "user.name", "Recoup Agent"],
  });
  await sandbox.runCommand({
    cmd: "git",
    args: ["config", "user.email", "agent@recoupable.com"],
  });

  return true;
}
