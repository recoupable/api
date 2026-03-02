import type { Sandbox } from "@vercel/sandbox";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { createGithubRepo } from "@/lib/github/createGithubRepo";
import { upsertAccountSnapshot } from "@/lib/supabase/account_snapshots/upsertAccountSnapshot";
import { runGitCommand } from "./helpers";
import type { SetupDeps } from "./types";

/**
 * Ensures a GitHub repository exists for the account, is persisted, and
 * is cloned into the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID
 * @param deps - Logging dependencies
 * @returns The github repo URL, or undefined if not configured
 */
export async function ensureGithubRepo(
  sandbox: Sandbox,
  accountId: string,
  deps: SetupDeps,
): Promise<string | undefined> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    deps.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  // Fetch github_repo from snapshot
  const snapshots = await selectAccountSnapshots(accountId);
  let githubRepo = snapshots[0]?.github_repo ?? null;
  const snapshotId = snapshots[0]?.snapshot_id ?? undefined;

  // If no repo exists, create one
  if (!githubRepo) {
    deps.log("No GitHub repo found, creating one");

    const accounts = await selectAccounts(accountId);
    const account = accounts[0];

    if (!account) {
      deps.error("Account not found for repo creation", { accountId });
      return undefined;
    }

    const repoUrl = await createGithubRepo(account.name, accountId);

    if (!repoUrl) {
      deps.error("Failed to create GitHub repo", { accountId });
      return undefined;
    }

    // Persist the repo URL
    deps.log("Persisting GitHub repo URL", { repoUrl });
    await upsertAccountSnapshot({
      account_id: accountId,
      snapshot_id: snapshotId,
      github_repo: repoUrl,
    });

    githubRepo = repoUrl;
  }

  // Check if repo is already cloned
  const gitCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-d", ".git"],
  });

  if (gitCheck.exitCode === 0) {
    deps.log("GitHub repo already cloned in sandbox");
    return githubRepo;
  }

  // Clone the repo into the sandbox root
  deps.log("Cloning GitHub repo into sandbox root");

  const repoUrl = githubRepo.replace(
    "https://github.com/",
    `https://x-access-token:${githubToken}@github.com/`,
  );

  if (!(await runGitCommand(sandbox, ["init"], "initialize git", deps))) {
    return undefined;
  }

  if (!(await runGitCommand(sandbox, ["remote", "add", "origin", repoUrl], "add remote", deps))) {
    return undefined;
  }

  // Fetch and checkout only if the remote has content
  const fetchResult = await sandbox.runCommand({
    cmd: "git",
    args: ["fetch", "origin"],
  });

  if (fetchResult.exitCode === 0) {
    const refCheck = await sandbox.runCommand({
      cmd: "git",
      args: ["rev-parse", "--verify", "origin/main"],
    });

    if (refCheck.exitCode === 0) {
      if (
        !(await runGitCommand(
          sandbox,
          ["checkout", "-B", "main", "origin/main"],
          "checkout main branch",
          deps,
        ))
      ) {
        return undefined;
      }

      // Set up URL rewriting for submodule clones
      await sandbox.runCommand({
        cmd: "git",
        args: [
          "config",
          `url.https://x-access-token:${githubToken}@github.com/.insteadOf`,
          "https://github.com/",
        ],
      });

      // Initialize submodules if they exist
      await sandbox.runCommand({
        cmd: "git",
        args: ["submodule", "update", "--init", "--recursive"],
      });
    } else {
      deps.log("Empty remote repo, skipping checkout");
    }
  } else {
    deps.log("Fetch failed or empty remote, skipping checkout");
  }

  deps.log("GitHub repo initialized in sandbox root");
  return githubRepo;
}
