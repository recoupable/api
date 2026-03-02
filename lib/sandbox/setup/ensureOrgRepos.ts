import type { Sandbox } from "@vercel/sandbox";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { createOrgGithubRepo } from "@/lib/github/createOrgGithubRepo";
import { sanitizeRepoName } from "@/lib/github/sanitizeRepoName";
import { runOpenClawAgent } from "./helpers";
import type { SetupDeps } from "./types";

/**
 * Ensures each of the account's organizations has a GitHub repo and
 * tells OpenClaw to clone them into `orgs/` in the workspace.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID to look up orgs for
 * @param deps - Logging dependencies
 */
export async function ensureOrgRepos(
  sandbox: Sandbox,
  accountId: string,
  deps: SetupDeps,
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    deps.error("Missing GITHUB_TOKEN for org repos");
    return;
  }

  deps.log("Fetching account organizations");
  const orgs = await getAccountOrganizations({ accountId });

  if (!orgs || orgs.length === 0) {
    deps.log("No organizations found, skipping org repo setup");
    return;
  }

  deps.log("Setting up org repos");

  const orgRepos: Array<{ name: string; url: string }> = [];

  for (const org of orgs) {
    const orgName = org.organization?.name ?? "unknown";
    const orgId = org.organization_id;

    const repoUrl = await createOrgGithubRepo(orgName, orgId);

    if (!repoUrl) {
      deps.error("Failed to create org GitHub repo, skipping", {
        orgId,
        orgName,
      });
      continue;
    }

    orgRepos.push({
      name: sanitizeRepoName(orgName),
      url: repoUrl,
    });
  }

  if (orgRepos.length === 0) {
    deps.log("No org repos created, skipping clone step");
    return;
  }

  const repoList = orgRepos.map(r => `- "${r.name}" -> ${r.url}`).join("\n");

  const message = [
    "Clone the following GitHub repositories into orgs/ in your workspace.",
    "Use the GITHUB_TOKEN environment variable for authentication.",
    "Replace https://github.com/ with https://x-access-token:$GITHUB_TOKEN@github.com/ in the clone URL.",
    "",
    "For each repo, check orgs/{name}:",
    "- If it has a .git directory OR a .git file (submodule gitlink), it's already a git repo -- run: git -C orgs/{name} pull origin main",
    "- If it exists but has neither a .git directory nor a .git file, remove it and clone fresh.",
    "- If it does not exist, clone the repo.",
    "",
    "IMPORTANT: Submodules use a .git file (gitlink), not a .git directory.",
    "Always check for BOTH: [ -d orgs/{name}/.git ] || [ -f orgs/{name}/.git ]",
    "",
    repoList,
  ].join("\n");

  await runOpenClawAgent(
    sandbox,
    {
      label: "Cloning org repos",
      message,
    },
    deps,
  );

  deps.log("Org repo setup complete");
}
