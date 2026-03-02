import type { Sandbox } from "@vercel/sandbox";
import { installSkill, runOpenClawAgent } from "./helpers";
import type { SetupDeps } from "./types";

/**
 * Ensures the sandbox has the org/artist folder structure set up.
 * Installs skills, runs setup-sandbox, then setup-artist for each artist.
 * Idempotent -- skips if `orgs/` directory already exists.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 * @param apiKey - The RECOUP_API_KEY
 * @param deps - Logging dependencies
 */
export async function ensureSetupSandbox(
  sandbox: Sandbox,
  accountId: string,
  apiKey: string,
  deps: SetupDeps,
): Promise<void> {
  const check = await sandbox.runCommand({
    cmd: "test",
    args: ["-d", "orgs/"],
  });

  if (check.exitCode === 0) {
    deps.log("Sandbox already set up, skipping");
    return;
  }

  deps.log("Installing skills");

  await installSkill(sandbox, "recoupable/setup-sandbox", deps);
  await installSkill(sandbox, "recoupable/setup-artist", deps);
  await installSkill(sandbox, "recoupable/release-management", deps);

  const env = {
    RECOUP_API_KEY: apiKey,
    RECOUP_ACCOUNT_ID: accountId,
  };

  deps.log("Running setup-sandbox skill");
  const setupResult = await runOpenClawAgent(
    sandbox,
    {
      label: "Running setup-sandbox skill",
      message:
        "Install the Recoup CLI globally: npm install -g @recoupable/cli\n\nThen run the /setup-sandbox skill to create the org and artist folder structure.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
      env,
    },
    deps,
  );

  if (setupResult.exitCode !== 0) {
    throw new Error("Failed to set up sandbox via OpenClaw");
  }

  deps.log("Running setup-artist skill");
  const artistResult = await runOpenClawAgent(
    sandbox,
    {
      label: "Running setup-artist skill",
      message:
        "Run the /setup-artist skill for EACH artist folder that exists under orgs/.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
      env,
    },
    deps,
  );

  if (artistResult.exitCode !== 0) {
    throw new Error("Failed to set up artists via OpenClaw");
  }
}
