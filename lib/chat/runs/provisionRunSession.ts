import ms from "ms";
import { createSessionWithInitialChat } from "@/lib/sessions/createSessionWithInitialChat";
import { connectSandbox } from "@/lib/sandbox/factory";
import { getSessionSandboxName } from "@/lib/sandbox/getSessionSandboxName";
import { resolveGitUser } from "@/lib/sandbox/resolveGitUser";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import { markSessionSandboxActive } from "@/lib/sandbox/markSessionSandboxActive";
import { installSessionGlobalSkills } from "@/lib/sandbox/installSessionGlobalSkills";
import { discoverSkills } from "@/lib/skills/discoverSkills";
import { getSandboxSkillDirectories } from "@/lib/skills/getSandboxSkillDirectories";
import { DEFAULT_WORKING_DIRECTORY } from "@/lib/sandbox/vercel/sandbox/constants";
import type { Json, Tables } from "@/types/database.types";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

const SANDBOX_TIMEOUT_MS = ms("30m");

// The platform API-access skill the agent needs to reach the Recoup API for
// account data. If it's missing post-provision the run is aborted (chat#1822).
const REQUIRED_PLATFORM_API_SKILL = "recoup-platform-api-access";

export type ProvisionedRunSession = {
  session: Tables<"sessions">;
  chat: Tables<"chats">;
  sandboxState: VercelState;
  workingDirectory: string;
  skills: SkillMetadata[];
};

/**
 * Headlessly provision a session + chat with an ACTIVE sandbox for a
 * `POST /api/chat/runs` run (recoupable/chat#1813) — composing the same shared
 * building blocks the interactive path uses: `createSessionWithInitialChat`
 * (`POST /api/sessions`) + `connectSandbox` / `markSessionSandboxActive`
 * (`POST /api/sandbox`). Server-side since there is no client session.
 *
 * @throws if repo/session/chat/sandbox provisioning fails — the caller maps it
 *   to a 5xx and revokes any minted ephemeral key.
 */
export async function provisionRunSession({
  accountId,
  title,
  artistId,
}: {
  accountId: string;
  title: string;
  artistId?: string;
}): Promise<ProvisionedRunSession> {
  const created = await createSessionWithInitialChat({
    accountId,
    title,
    chatTitle: "Scheduled generation",
    artistId,
  });
  if (created.ok === false) {
    throw new Error(
      created.reason === "repo"
        ? "Failed to provision workspace repository"
        : "Failed to create session",
    );
  }
  const { session, chat } = created;

  const sandbox = await connectSandbox({
    state: {
      type: "vercel",
      sandboxName: getSessionSandboxName(session.id),
      source: { repo: session.clone_url, prebuilt: false },
    },
    options: {
      timeout: SANDBOX_TIMEOUT_MS,
      ports: [3000],
      githubToken: getServiceGithubToken(),
      gitUser: await resolveGitUser(accountId),
      persistent: true,
      resume: true,
      createIfMissing: true,
    },
  });

  const updated = await markSessionSandboxActive(session, sandbox.getState() as Json);
  if (!updated) throw new Error("Failed to activate session sandbox");

  // Install global skills BEFORE discovery — the headless run path must
  // provision skills, not just discover them. Without this the sandbox skills
  // dir is empty, `discoverSkills` returns [], the agent gets no `skill` tool,
  // and it falls back to guessing API endpoints + fabricating (chat#1822).
  // Best-effort: a failed install must not block the run (mirrors
  // `createSandboxHandler`).
  try {
    await installSessionGlobalSkills({ sessionRow: updated, sandbox });
  } catch (error) {
    console.error("[provisionRunSession] installSessionGlobalSkills failed:", error);
  }

  // Best-effort skill + working-directory discovery from the live handle —
  // a failure falls back to defaults so the run can still start (tools surface
  // the underlying issue when they reconnect). Mirrors handleChatWorkflowStream.
  let workingDirectory = DEFAULT_WORKING_DIRECTORY;
  let skills: SkillMetadata[] = [];
  try {
    workingDirectory = sandbox.workingDirectory;
    skills = await discoverSkills(sandbox, await getSandboxSkillDirectories(sandbox));
  } catch (error) {
    console.error("[provisionRunSession] skill discovery failed; using defaults:", error);
  }

  // Fail closed: if the platform API-access skill isn't available after install
  // + discovery, abort instead of running an agent that can't reach the Recoup
  // API — which guesses endpoints and fabricates ungrounded data (chat#1822).
  // A missed run is recoverable; a fabricated report sent to a customer is not.
  // The caller maps this throw to a 5xx and revokes any minted ephemeral key.
  if (!skills.some(skill => skill.name === REQUIRED_PLATFORM_API_SKILL)) {
    throw new Error(
      `[provisionRunSession] required skill '${REQUIRED_PLATFORM_API_SKILL}' unavailable after install/discovery — aborting to avoid an ungrounded run`,
    );
  }

  return {
    session: updated,
    chat,
    sandboxState: updated.sandbox_state as VercelState,
    workingDirectory,
    skills,
  };
}
