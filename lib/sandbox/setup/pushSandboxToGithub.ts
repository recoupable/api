import type { Sandbox } from "@vercel/sandbox";
import { runGitCommand, runOpenClawAgent } from "./helpers";
import type { SetupDeps } from "./types";

/**
 * Copies ~/.openclaw into the repo, strips tokens from .gitmodules,
 * and pushes org repos via OpenClaw.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
async function copyOpenClawToRepo(sandbox: Sandbox): Promise<void> {
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "rm -rf /vercel/sandbox/.openclaw && " +
        "cp -r ~/.openclaw /vercel/sandbox/.openclaw && " +
        "rm -rf /vercel/sandbox/.openclaw/workspace/orgs && " +
        "find /vercel/sandbox/.openclaw -name .git -type d -exec rm -rf {} + 2>/dev/null || true",
    ],
  });
}

/**
 * Registers org repos as git submodules in the sandbox working directory.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
async function addOrgSubmodules(sandbox: Sandbox): Promise<void> {
  if (!process.env.GITHUB_TOKEN) return;

  const homeResult = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "echo ~"],
  });
  const homeDir = ((await homeResult.stdout()) || "").trim() || "/root";
  const workspaceOrgs = `${homeDir}/.openclaw/workspace/orgs`;

  const findResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `find ${workspaceOrgs} -mindepth 1 -maxdepth 1 -type d '(' -exec test -d {}/.git ';' -o -exec test -f {}/.git ';' ')' -print 2>/dev/null | xargs -I{} basename {}`,
    ],
  });

  const stdout = (await findResult.stdout()) || "";
  const orgNames = stdout
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (orgNames.length === 0) return;

  for (const name of orgNames) {
    const orgPath = `.openclaw/workspace/orgs/${name}`;

    const remoteResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", `${workspaceOrgs}/${name}`, "remote", "get-url", "origin"],
    });
    const remoteUrl = ((await remoteResult.stdout()) || "").trim();
    if (!remoteUrl) continue;

    const checkResult = await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `test -f ${orgPath}/.git && git config --file .gitmodules --get submodule.${orgPath}.url 2>/dev/null`,
      ],
    });
    if (checkResult.exitCode === 0) continue;

    await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `git rm -r --cached ${orgPath} 2>/dev/null || true; ` +
          `git config --remove-section submodule.${orgPath} 2>/dev/null || true; ` +
          `rm -rf .git/modules/${orgPath} ${orgPath} 2>/dev/null || true`,
      ],
    });

    const authedUrl = remoteUrl.replace(
      "https://github.com/",
      `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/`,
    );
    await sandbox.runCommand({
      cmd: "git",
      args: ["submodule", "add", authedUrl, orgPath],
    });
  }
}

/**
 * Strips x-access-token auth from .gitmodules.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
async function stripGitmodulesTokens(sandbox: Sandbox): Promise<void> {
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "sed -i 's|https://x-access-token:[^@]*@github.com/|https://github.com/|g' .gitmodules 2>/dev/null || true; " +
        "git add .gitmodules 2>/dev/null || true",
    ],
  });
}

/**
 * Pushes org repo changes via OpenClaw.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param deps - Logging dependencies
 */
async function pushOrgRepos(sandbox: Sandbox, deps: SetupDeps): Promise<void> {
  if (!process.env.GITHUB_TOKEN) return;

  const homeResult = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "echo ~"],
  });
  const homeDir = ((await homeResult.stdout()) || "").trim() || "/root";
  const workspaceOrgs = `${homeDir}/.openclaw/workspace/orgs`;

  const findResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `find ${workspaceOrgs} -mindepth 1 -maxdepth 1 -type d -exec test -d {}/.git \\; -print 2>/dev/null | xargs -I{} basename {}`,
    ],
  });

  const stdout = (await findResult.stdout()) || "";
  const orgNames = stdout
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (orgNames.length === 0) return;

  const message = [
    "Commit and push changes for each org repo.",
    "Org repos are at ~/.openclaw/workspace/orgs/",
    "",
    "For each org directory that is a git repo:",
    "1. git add -A",
    "2. git commit -m 'Update org files' (skip if nothing to commit)",
    "3. git push origin HEAD:main --force (always push if there are unpushed commits)",
  ].join("\n");

  await runOpenClawAgent(
    sandbox,
    {
      label: "Pushing org repo changes",
      message,
    },
    deps,
  );
}

/**
 * Commits and pushes all local sandbox files to the GitHub repository.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param deps - Logging dependencies
 * @returns true if push succeeded or there were no changes, false on error
 */
export async function pushSandboxToGithub(sandbox: Sandbox, deps: SetupDeps): Promise<boolean> {
  deps.log("Pushing sandbox files to GitHub");

  if (
    !(await runGitCommand(
      sandbox,
      ["config", "user.email", "agent@recoupable.com"],
      "configure git email",
      deps,
    ))
  ) {
    return false;
  }

  if (
    !(await runGitCommand(
      sandbox,
      ["config", "user.name", "Recoup Agent"],
      "configure git name",
      deps,
    ))
  ) {
    return false;
  }

  await pushOrgRepos(sandbox, deps);
  await copyOpenClawToRepo(sandbox);
  await addOrgSubmodules(sandbox);
  await stripGitmodulesTokens(sandbox);

  if (!(await runGitCommand(sandbox, ["add", "-A"], "stage files", deps))) {
    return false;
  }

  const diffResult = await sandbox.runCommand({
    cmd: "git",
    args: ["diff", "--cached", "--quiet"],
  });

  if (diffResult.exitCode !== 0) {
    if (
      !(await runGitCommand(
        sandbox,
        ["commit", "-m", "Update sandbox files"],
        "commit changes",
        deps,
      ))
    ) {
      return false;
    }
  }

  await sandbox.runCommand({ cmd: "git", args: ["rebase", "--abort"] });

  if (
    !(await runGitCommand(
      sandbox,
      ["push", "--force", "origin", "HEAD:main"],
      "push to remote",
      deps,
    ))
  ) {
    return false;
  }

  deps.log("Sandbox files pushed to GitHub successfully");
  return true;
}
