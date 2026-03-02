import type { Sandbox } from "@vercel/sandbox";
import { installOpenClaw } from "./installOpenClaw";
import { setupOpenClaw } from "./setupOpenClaw";
import { ensureGithubRepo } from "./ensureGithubRepo";
import { writeReadme } from "./writeReadme";
import { ensureOrgRepos } from "./ensureOrgRepos";
import { ensureSetupSandbox } from "./ensureSetupSandbox";
import type { SetupDeps } from "./types";

interface SetupFreshSandboxInput {
  sandbox: Sandbox;
  accountId: string;
  apiKey: string;
}

/**
 * Runs the full setup pipeline for a fresh sandbox (no snapshot).
 * Yields progress messages as stderr chunks compatible with promptSandboxStreaming.
 * Returns the GitHub repo URL (or undefined) when complete.
 *
 * @param input - The sandbox, account ID, and API key
 * @yields Progress messages as { data, stream: "stderr" } chunks
 * @returns The GitHub repo URL, or undefined
 */
export async function* setupFreshSandbox(
  input: SetupFreshSandboxInput,
): AsyncGenerator<{ data: string; stream: "stderr" }, string | undefined, undefined> {
  const { sandbox, accountId, apiKey } = input;

  const deps: SetupDeps = {
    log: msg => console.log(`[Setup] ${msg}`),
    error: (msg, data) => console.error(`[Setup] ${msg}`, data),
  };

  yield { data: "[Setup] Installing OpenClaw...\n", stream: "stderr" };
  await installOpenClaw(sandbox, deps);

  yield { data: "[Setup] Configuring OpenClaw...\n", stream: "stderr" };
  await setupOpenClaw(sandbox, accountId, apiKey, deps);

  yield {
    data: "[Setup] Setting up GitHub repository...\n",
    stream: "stderr",
  };
  const githubRepo = await ensureGithubRepo(sandbox, accountId, deps);

  yield { data: "[Setup] Writing README...\n", stream: "stderr" };
  await writeReadme(sandbox, sandbox.sandboxId, accountId, githubRepo, deps);

  yield {
    data: "[Setup] Setting up organization repos...\n",
    stream: "stderr",
  };
  await ensureOrgRepos(sandbox, accountId, deps);

  yield {
    data: "[Setup] Installing skills and running setup...\n",
    stream: "stderr",
  };
  await ensureSetupSandbox(sandbox, accountId, apiKey, deps);

  yield { data: "[Setup] Setup complete!\n", stream: "stderr" };

  return githubRepo;
}
