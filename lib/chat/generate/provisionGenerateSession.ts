import ms from "ms";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { buildSessionInsertRow } from "@/lib/sessions/buildSessionInsertRow";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { connectSandbox } from "@/lib/sandbox/factory";
import { getSessionSandboxName } from "@/lib/sandbox/getSessionSandboxName";
import { resolveGitUser } from "@/lib/sandbox/resolveGitUser";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import { buildActiveLifecycleUpdate } from "@/lib/sandbox/buildActiveLifecycleUpdate";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { discoverSkills } from "@/lib/skills/discoverSkills";
import { getSandboxSkillDirectories } from "@/lib/skills/getSandboxSkillDirectories";
import { DEFAULT_WORKING_DIRECTORY } from "@/lib/sandbox/vercel/sandbox/constants";
import type { Json, Tables } from "@/types/database.types";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import type { SkillMetadata } from "@/lib/skills/skillTypes";

const SANDBOX_TIMEOUT_MS = ms("30m");

export type ProvisionedGenerateSession = {
  session: Tables<"sessions">;
  chat: Tables<"chats">;
  sandboxState: VercelState;
  workingDirectory: string;
  skills: SkillMetadata[];
};

/**
 * Headlessly provision a session + chat with an ACTIVE sandbox for a scheduled
 * `/api/chat/generate` run (recoupable/chat#1813) — the same building blocks the
 * interactive path uses (`POST /api/sessions` + `POST /api/sandbox`), composed
 * server-side since there is no client session. Mirrors `createSandboxHandler`'s
 * connect → `buildActiveLifecycleUpdate` → `updateSession` binding so the
 * provisioned session passes `isSandboxActive`.
 *
 * @throws if repo/session/chat/sandbox provisioning fails — the caller maps it
 *   to a 5xx and revokes any minted ephemeral key.
 */
export async function provisionGenerateSession({
  accountId,
  title,
  artistId,
}: {
  accountId: string;
  title: string;
  artistId?: string;
}): Promise<ProvisionedGenerateSession> {
  const cloneUrl = await ensurePersonalRepo({ accountId });
  if (!cloneUrl) throw new Error("Failed to provision workspace repository");

  const session = await insertSession(
    buildSessionInsertRow({ accountId, title, cloneUrl, artistId }),
  );
  if (!session) throw new Error("Failed to create session");

  const chat = await insertChat({
    id: generateUUID(),
    session_id: session.id,
    title: "Scheduled generation",
  });
  if (!chat) throw new Error("Failed to create chat");

  const sandboxName = getSessionSandboxName(session.id);
  const gitUser = await resolveGitUser(accountId);
  const sandbox = await connectSandbox({
    state: { type: "vercel", sandboxName, source: { repo: cloneUrl, prebuilt: false } },
    options: {
      timeout: SANDBOX_TIMEOUT_MS,
      ports: [3000],
      githubToken: getServiceGithubToken(),
      gitUser,
      persistent: true,
      resume: true,
      createIfMissing: true,
    },
  });

  const sandboxState = sandbox.getState() as Json;
  const updated = await updateSession(session.id, {
    sandbox_state: sandboxState,
    lifecycle_version: session.lifecycle_version + 1,
    ...buildActiveLifecycleUpdate(sandboxState),
    snapshot_url: null,
    snapshot_created_at: null,
  });
  if (!updated) throw new Error("Failed to activate session sandbox");

  // Best-effort skill + working-directory discovery from the live handle —
  // a failure falls back to defaults so the run can still start (tools surface
  // the underlying issue when they reconnect). Mirrors handleChatWorkflowStream.
  let workingDirectory = DEFAULT_WORKING_DIRECTORY;
  let skills: SkillMetadata[] = [];
  try {
    workingDirectory = sandbox.workingDirectory;
    skills = await discoverSkills(sandbox, await getSandboxSkillDirectories(sandbox));
  } catch (error) {
    console.error("[provisionGenerateSession] skill discovery failed; using defaults:", error);
  }

  return {
    session: updated,
    chat,
    sandboxState: updated.sandbox_state as VercelState,
    workingDirectory,
    skills,
  };
}
