import type { UIMessage } from "ai";
import type { RunAgentWorkflowInput } from "@/app/lib/workflows/runAgentWorkflow";
import type { DurableAgentContext } from "@/lib/agent/tools/AgentContext";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import { parseGitHubRepoIdentifiers } from "@/lib/github/parseGitHubRepoIdentifiers";
import { extractOrgId } from "@/lib/recoupable/extractOrgId";

export type BuildRunAgentInputParams = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  accountId: string;
  modelId: string;
  /** Active artist for the run — surfaced in the agent's system prompt (chat#1837). */
  artistId?: string;
  sessionTitle?: string;
  /** `session.clone_url` — the single source for repo ids + recoup org id. */
  cloneUrl: string | null;
  sandboxState: VercelState;
  workingDirectory: string;
  skills: DurableAgentContext["skills"];
  /**
   * Short-lived bearer for in-sandbox recoup-api calls: the user's Privy JWT
   * (interactive `/api/chat/workflow`) or an ephemeral account key (headless
   * `/api/chat/runs`). Omitted when absent so the service key never leaks.
   */
  recoupAccessToken?: string;
  /** True for interactive chat (default), false for headless runs (withholds ask_user_question). */
  interactive?: boolean;
  /**
   * Row id of an ephemeral key minted for a headless run, so the workflow can
   * delete it on run end (recoupable/chat#1813). Interactive callers omit it.
   */
  ephemeralKeyId?: string;
};

/**
 * Build the durable `RunAgentWorkflowInput` shared by the interactive and
 * headless callers, so both construct workflow input identically
 * (recoupable/chat#1813). Repo identifiers and the recoup org id are both
 * derived from `cloneUrl` here — one source of truth, no caller duplication.
 */
export function buildRunAgentInput({
  messages,
  chatId,
  sessionId,
  accountId,
  modelId,
  artistId,
  sessionTitle,
  cloneUrl,
  sandboxState,
  workingDirectory,
  skills,
  recoupAccessToken,
  ephemeralKeyId,
  interactive,
}: BuildRunAgentInputParams): RunAgentWorkflowInput {
  const repoIds = parseGitHubRepoIdentifiers(cloneUrl);
  const recoupOrgId = cloneUrl ? (extractOrgId(cloneUrl) ?? undefined) : undefined;

  return {
    messages,
    chatId,
    sessionId,
    accountId,
    modelId,
    artistId,
    sessionTitle,
    interactive,
    repoOwner: repoIds?.owner,
    repoName: repoIds?.repo,
    agentContext: {
      sandbox: { state: sandboxState, workingDirectory },
      recoupOrgId,
      skills,
      ...(recoupAccessToken ? { recoupAccessToken } : {}),
      ...(ephemeralKeyId ? { ephemeralKeyId } : {}),
    },
  };
}
